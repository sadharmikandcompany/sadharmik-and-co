-- Mirrors serves_mandir_customers (see add_distributor_mandir_opt_out.sql):
-- a distributor can service a pincode generally but opt out of Shop-tier
-- customers specifically within it. Shop customers were previously ALWAYS
-- factory-direct regardless of distributor -- this makes that the default
-- (serves_shop_customers = true) rather than a hardcoded rule, so a
-- distributor can actually take on Shop-tier customers in their area unless
-- they opt out, same mechanism as Mandir.
ALTER TABLE public.distributors
  ADD COLUMN IF NOT EXISTS serves_shop_customers boolean NOT NULL DEFAULT true;
