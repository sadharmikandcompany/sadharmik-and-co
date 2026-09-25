-- Backend support for the Sadharmik Delivery rider app (delivery-app/), which
-- talks to /api/rider/* routes using a rider-specific login (phone + PIN),
-- separate from the CRM's own Supabase Auth login.

-- Riders log in with mobile + a PIN/password set by an admin on the
-- Delivery Partners page — hashed with bcrypt, never stored in plain text.
ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS password_hash text;

-- Reschedule needs a reason recorded alongside the new date; next_delivery_at
-- already existed for the date itself.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reschedule_reason text;

-- Cash/COD a rider has collected but not yet handed in to the office. Every
-- COD/cash order they deliver starts unsettled (false); there's no
-- office-side "mark settled" UI yet (a later feature), so today this
-- effectively means "all COD collected by this rider, ever" — the column
-- exists now so that later feature doesn't need its own migration.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cod_settled boolean NOT NULL DEFAULT false;

-- Rider-submitted expenses (fuel, food, vehicle repair, etc. while on a
-- delivery run) — the app's Expenses tab.
CREATE TABLE IF NOT EXISTS public.rider_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_partner_id uuid NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  category text,
  notes text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT rider_expenses_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_rider_expenses_delivery_partner_id
  ON public.rider_expenses (delivery_partner_id);

ALTER TABLE public.rider_expenses DISABLE ROW LEVEL SECURITY;
