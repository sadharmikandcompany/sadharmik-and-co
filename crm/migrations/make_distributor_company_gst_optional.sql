-- Not every distributor is a registered company with a GST number — some
-- are individuals. Company Name and GST Number are no longer required on
-- the Add/Edit Distributor form; this drops the matching NOT NULL
-- constraints so saving one without them doesn't fail at the database
-- level after the UI stopped requiring it.
ALTER TABLE public.distributors
  ALTER COLUMN company_name DROP NOT NULL,
  ALTER COLUMN gst_number DROP NOT NULL;
