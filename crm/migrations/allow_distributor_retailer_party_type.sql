-- credit_notes/debit_notes party_type only allowed 'customer'/'vendor', but the
-- PartyCombobox now also searches distributors and retailers (they're
-- transactional entities that get invoiced same as customers). Without this,
-- selecting a distributor/retailer in the search would show up fine but fail
-- to save with a CHECK constraint violation.

ALTER TABLE public.credit_notes DROP CONSTRAINT IF EXISTS credit_notes_party_type_check;
ALTER TABLE public.credit_notes ADD CONSTRAINT credit_notes_party_type_check
  CHECK (party_type = ANY (ARRAY['customer'::text, 'vendor'::text, 'distributor'::text, 'retailer'::text]));

ALTER TABLE public.debit_notes DROP CONSTRAINT IF EXISTS debit_notes_party_type_check;
ALTER TABLE public.debit_notes ADD CONSTRAINT debit_notes_party_type_check
  CHECK (party_type = ANY (ARRAY['customer'::text, 'vendor'::text, 'distributor'::text, 'retailer'::text]));
