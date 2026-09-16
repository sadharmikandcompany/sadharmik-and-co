-- Until now, a payment recorded in Reconciliation only updated a purchase's
-- paid_amount if you manually picked one specific bill in the "Link to a
-- bill (optional)" picker — genuinely optional, so most payments never
-- touched it at all. Purchases stayed stuck at their original remaining_amount
-- indefinitely even though real money had gone out, which is what drove the
-- Vendor panel's payable total and the overall outstanding figure up to
-- ~₹21.8L (just on purchases) despite payments being recorded.
--
-- Fix: payments now auto-allocate against a vendor's oldest open bills
-- first (FIFO — same default behavior as Tally/Vyapar) whenever a specific
-- bill isn't explicitly chosen, and a single payment can legitimately cover
-- part of one bill and part of the next. That means one bank_transaction
-- can now correctly correspond to N purchases, which the existing single
-- "PURCHASE:<id>" reference string can't represent — hence this table,
-- which is the actual source of truth for "this payment covered these
-- amounts against these bills," so editing or deleting a payment can
-- reverse exactly the right amounts from exactly the right bills.

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transaction_id uuid NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount_applied numeric NOT NULL CHECK (amount_applied > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_txn ON public.payment_allocations (bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_purchase ON public.payment_allocations (purchase_id);
