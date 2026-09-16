-- The Order-from-Factory Tally auto-fill "remembers" a product match the
-- first time you manually resolve an unmatched line item, so the same
-- description auto-matches on future invoices. That save was silently
-- failing (client only logs it to console) because this table has no
-- INSERT/UPDATE policy for authenticated users — RLS was blocking every
-- write, so it always asked again instead of remembering.
CREATE POLICY "Authenticated users can upsert tally product mappings"
  ON public.tally_product_mappings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
