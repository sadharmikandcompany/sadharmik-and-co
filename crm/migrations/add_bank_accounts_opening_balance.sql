-- bank_accounts.current_balance was being used for two different things at
-- once: (1) a live running balance, incremented/decremented on every
-- transaction via the app (adjustAccountBalance), and (2) the field the
-- "Edit Account" dialog pre-fills and directly overwrites when someone
-- wants to correct the account's starting figure. Those two purposes
-- conflict — editing "Opening Balance" just replaced current_balance
-- outright, silently discarding every transaction logged since account
-- creation instead of adding the correction on top of them. This is what
-- caused HDFC Bank's displayed balance to go from a plausible running total
-- to a raw pre-transaction figure on 2026-08-18.
--
-- Splitting these into two real columns fixes it: opening_balance is a
-- fixed reference point you set once (or rarely correct), current_balance
-- stays the live figure, and the app now recomputes
-- current_balance = opening_balance + net(all transactions) whenever
-- opening_balance changes, instead of blindly overwriting it.

ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS opening_balance numeric;

-- Backfill: for every account that doesn't have one yet, assume its
-- current_balance up to now already included transaction history the
-- normal way (the common case), so back-derive what its opening_balance
-- must have been: current_balance - net(Cr-Dr) of all its transactions.
UPDATE public.bank_accounts b
SET opening_balance = b.current_balance - COALESCE((
  SELECT SUM(CASE WHEN t.txn_type = 'Cr' THEN t.amount ELSE -t.amount END)
  FROM public.bank_transactions t
  WHERE t.bank_account_id = b.id
), 0)
WHERE b.opening_balance IS NULL;
