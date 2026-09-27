-- A distributor can service a pincode generally but opt out of Mandir/
-- Temple customers specifically within it (e.g. a Ghatkopar distributor who
-- covers the area but doesn't want to handle Mandir deliveries there) — the
-- order then falls back to having no distributor match at all, same as any
-- unserviced pincode, meaning it's fulfilled in-house instead.
ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS serves_mandir_customers boolean NOT NULL DEFAULT true;
