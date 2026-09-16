-- Schema sync: brings sandbox up to date with current production schema

-- 1. Tables missing from the original dump

-- Missing tables (found on production but not in the original database.sql dump)

CREATE TABLE IF NOT EXISTS public.blogs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT ''::text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft'::text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  author_id uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blogs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text]))),
  CONSTRAINT blogs_pkey PRIMARY KEY (id),
  CONSTRAINT blogs_slug_key UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.licenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  pdf_url text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT licenses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.myoperator_latest_call (
  id integer NOT NULL DEFAULT 1,
  phone_number text,
  call_id text,
  agent_id text,
  agent_name text,
  direction text,
  timestamp timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT myoperator_latest_call_id_check CHECK ((id = 1)),
  CONSTRAINT myoperator_latest_call_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.myoperator_live_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id text NOT NULL,
  caller_number text NOT NULL,
  called_number text,
  direction text,
  status text,
  agent_name text,
  agent_number text,
  agent_id text,
  department text,
  timestamp timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT myoperator_live_calls_pkey PRIMARY KEY (id),
  CONSTRAINT myoperator_live_calls_call_id_key UNIQUE (call_id)
);

CREATE TABLE IF NOT EXISTS public.myoperator_whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  direction text,
  from_number text,
  to_number text,
  message_type text,
  content text,
  template_name text,
  status text,
  status_timestamp timestamp with time zone,
  error_code text,
  error_message text,
  customer_id uuid,
  raw_payload jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT myoperator_whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text]))),
  CONSTRAINT myoperator_whatsapp_messages_pkey PRIMARY KEY (id),
  CONSTRAINT myoperator_whatsapp_messages_message_id_key UNIQUE (message_id)
);

CREATE TABLE IF NOT EXISTS public.opening_stock_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stock_type text NOT NULL,
  product_id uuid,
  variant_id uuid,
  sku text,
  godown_id uuid,
  distributor_id uuid,
  retailer_id uuid,
  quantity numeric NOT NULL,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  unit_price numeric NOT NULL DEFAULT 0,
  CONSTRAINT opening_stock_entries_stock_type_check CHECK ((stock_type = ANY (ARRAY['warehouse'::text, 'distributor'::text, 'retailer'::text, 'manufacturing'::text]))),
  CONSTRAINT opening_stock_entries_quantity_check CHECK ((quantity >= (0)::numeric)),
  CONSTRAINT opening_stock_location_match CHECK ((((stock_type = 'warehouse'::text) AND (godown_id IS NOT NULL)) OR ((stock_type = 'distributor'::text) AND (distributor_id IS NOT NULL)) OR ((stock_type = 'retailer'::text) AND (retailer_id IS NOT NULL)) OR (stock_type = 'manufacturing'::text))),
  CONSTRAINT opening_stock_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.order_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  assignment_id uuid,
  delivery_partner_id uuid,
  request_type text NOT NULL,
  request_status text NOT NULL DEFAULT 'pending'::text,
  requested_changes jsonb NOT NULL,
  reason text NOT NULL,
  driver_notes text,
  admin_notes text,
  admin_response text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT order_change_requests_request_type_check CHECK ((request_type = ANY (ARRAY['item_change'::text, 'quantity_change'::text, 'address_change'::text, 'other'::text]))),
  CONSTRAINT order_change_requests_request_status_check CHECK ((request_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text]))),
  CONSTRAINT order_change_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.product_pincode_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  pincode text NOT NULL,
  customer_price numeric,
  customer_sale_price numeric,
  distributor_price numeric,
  distributor_sale_price numeric,
  sub_distributor_price numeric,
  sub_distributor_sale_price numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  retailer_price numeric,
  retailer_sale_price numeric,
  CONSTRAINT product_pincode_pricing_customer_price_check CHECK (((customer_price IS NULL) OR (customer_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_customer_sale_price_check CHECK (((customer_sale_price IS NULL) OR (customer_sale_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_distributor_price_check CHECK (((distributor_price IS NULL) OR (distributor_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_distributor_sale_price_check CHECK (((distributor_sale_price IS NULL) OR (distributor_sale_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_sub_distributor_price_check CHECK (((sub_distributor_price IS NULL) OR (sub_distributor_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_sub_distributor_sale_price_check CHECK (((sub_distributor_sale_price IS NULL) OR (sub_distributor_sale_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_pkey PRIMARY KEY (id),
  CONSTRAINT unique_product_pincode UNIQUE (product_id, pincode),
  CONSTRAINT product_pincode_pricing_retailer_price_check CHECK (((retailer_price IS NULL) OR (retailer_price >= (0)::numeric))),
  CONSTRAINT product_pincode_pricing_retailer_sale_price_check CHECK (((retailer_sale_price IS NULL) OR (retailer_sale_price >= (0)::numeric)))
);

CREATE TABLE IF NOT EXISTS public.retailer_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  reference text,
  notes text,
  added_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT retailer_payments_amount_check CHECK ((amount > (0)::numeric)),
  CONSTRAINT retailer_payments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  product_name text,
  reviewer_name text NOT NULL,
  rating smallint NOT NULL,
  title text,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  is_ai_generated boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tax_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  txn_date date NOT NULL,
  txn_type character varying(50) NOT NULL,
  reference_type character varying(50),
  reference_id uuid,
  party_name character varying(255),
  gstin character varying(15),
  hsn character varying(20),
  taxable_value numeric DEFAULT 0,
  cgst_rate numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_rate numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_rate numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  cess_amount numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  invoice_number character varying(100),
  is_b2b boolean DEFAULT false,
  state_code character varying(5),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tax_ledger_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.vendor_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  product_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendor_products_pkey PRIMARY KEY (id),
  CONSTRAINT vendor_products_vendor_id_product_id_key UNIQUE (vendor_id, product_id)
);

-- Foreign keys for these tables (wrapped so re-running is safe if already applied)

DO $$ BEGIN ALTER TABLE public.blogs ADD CONSTRAINT blogs_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.licenses ADD CONSTRAINT licenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.myoperator_whatsapp_messages ADD CONSTRAINT myoperator_whatsapp_messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opening_stock_entries ADD CONSTRAINT opening_stock_entries_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opening_stock_entries ADD CONSTRAINT opening_stock_entries_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opening_stock_entries ADD CONSTRAINT opening_stock_entries_godown_id_fkey FOREIGN KEY (godown_id) REFERENCES godowns(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opening_stock_entries ADD CONSTRAINT opening_stock_entries_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opening_stock_entries ADD CONSTRAINT opening_stock_entries_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.opening_stock_entries ADD CONSTRAINT opening_stock_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES route_assignments(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES delivery_partners(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.retailer_payments ADD CONSTRAINT retailer_payments_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES retailers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.retailer_payments ADD CONSTRAINT retailer_payments_added_by_fkey FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reviews ADD CONSTRAINT reviews_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendor_products ADD CONSTRAINT vendor_products_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.vendor_products ADD CONSTRAINT vendor_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Column drift on existing tables

ALTER TABLE public.credit_note_items ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
ALTER TABLE public.debit_note_items ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_category text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_factory_order boolean DEFAULT false;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS created_by_user_id uuid;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS is_special boolean DEFAULT false;
ALTER TABLE public.retailers ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS opening_balance numeric DEFAULT 0;

-- 3. Views

CREATE OR REPLACE VIEW public.attendance_summary AS
SELECT u.id AS user_id,
    u.full_name,
    u.email,
    u.role,
    count(
        CASE
            WHEN (a.status = 'present'::attendance_status) THEN 1
            ELSE NULL::integer
        END) AS present_days,
    count(
        CASE
            WHEN (a.status = 'absent'::attendance_status) THEN 1
            ELSE NULL::integer
        END) AS absent_days,
    count(
        CASE
            WHEN (a.status = 'half_day'::attendance_status) THEN 1
            ELSE NULL::integer
        END) AS half_days,
    count(
        CASE
            WHEN (a.status = 'leave'::attendance_status) THEN 1
            ELSE NULL::integer
        END) AS leave_days,
    sum(a.total_hours) AS total_hours_worked,
    date_trunc('month'::text, (a.date)::timestamp with time zone) AS month
   FROM (users u
     LEFT JOIN attendance a ON ((u.id = a.user_id)))
  GROUP BY u.id, u.full_name, u.email, u.role, (date_trunc('month'::text, (a.date)::timestamp with time zone));

CREATE OR REPLACE VIEW public.orders_v AS
SELECT o.id,
    o.order_number,
    o.customer_id,
    o.distributor_id,
    o.order_status,
    o.payment_status,
    o.payment_method,
    o.transaction_id,
    o.shipping_flat_number,
    o.shipping_floor_wing,
    o.shipping_building_name,
    o.shipping_street_area,
    o.shipping_landmark,
    o.shipping_pincode,
    o.shipping_country,
    o.shipping_state,
    o.shipping_city,
    o.billing_flat_number,
    o.billing_floor_wing,
    o.billing_building_name,
    o.billing_street_area,
    o.billing_landmark,
    o.billing_pincode,
    o.billing_country,
    o.billing_state,
    o.billing_city,
    o.subtotal,
    o.discount_amount,
    o.tax_amount,
    o.gst_amount,
    o.shipping_charges,
    o.total_amount,
    o.cgst_amount,
    o.sgst_amount,
    o.igst_amount,
    o.shipping_method,
    o.tracking_number,
    o.courier_partner,
    o.expected_delivery_date,
    o.shipped_date,
    o.delivered_date,
    o.order_notes,
    o.customer_notes,
    o.internal_notes,
    o.is_priority,
    o.order_date,
    o.created_at,
    o.updated_at,
    o.created_by_user_id,
    o.created_by_agent_id,
    o.created_by_agent_name,
    o.shipping_full_address,
    o.billing_full_address,
    o.shipping_room_number,
    o.shipping_floor,
    o.shipping_wing,
    o.billing_room_number,
    o.billing_floor,
    o.billing_wing,
    o.invoice_number_gst,
    o.invoice_number_non_gst,
    o.is_gst_invoice,
    o.source,
    o.is_distributor,
    o.is_subdistributor,
    o.delivery_partner_id,
    o.assigned_to_delivery_at,
    o.retailer_id,
    o.customer_gst_number,
    o.customer_pan_number,
    o.cod_amount,
    o.failed_at,
    o.failure_reason,
    o.failed_attempts,
    o.cancelled_at,
    o.next_delivery_at,
    o.customer_first_name,
    o.customer_last_name,
    o.customer_full_name,
    o.source_godown_id,
    o.cancellation_reason,
    o.cancelled_by,
    o.delivery_status,
    o.cod_collected_amount,
    o.cod_payment_method,
    o.delivery_proof_url,
    o.customer_signature_url,
    o.delivery_latitude,
    o.delivery_longitude,
    o.easebuzz_txn_id,
    o.company_name,
    o.cheque_number,
    o.destination_godown_id,
    COALESCE(
        CASE
            WHEN (o.customer_id IS NOT NULL) THEN TRIM(BOTH FROM ((COALESCE(c.first_name, ''::text) || ' '::text) || COALESCE(c.last_name, ''::text)))
            ELSE NULL::text
        END,
        CASE
            WHEN (o.retailer_id IS NOT NULL) THEN (r.name || ' (Retailer)'::text)
            ELSE NULL::text
        END,
        CASE
            WHEN (o.distributor_id IS NOT NULL) THEN (d.name ||
            CASE
                WHEN (o.is_subdistributor = true) THEN ' (Subdistributor)'::text
                ELSE ' (Distributor)'::text
            END)
            ELSE NULL::text
        END, 'Unknown'::text) AS customer_name,
    COALESCE(c.mobile_primary, r.phone_primary, d.phone_primary) AS customer_phone,
    c.mobile_secondary_1 AS customer_phone_secondary_1,
    c.mobile_secondary_2 AS customer_phone_secondary_2,
        CASE
            WHEN (c.whatsapp_same_as_primary = true) THEN NULL::text
            ELSE c.whatsapp_number
        END AS customer_whatsapp,
    COALESCE(c.full_address, r.company_name, d.company_name) AS customer_full_address,
    c.vip_number AS customer_vip_number,
    c.email AS customer_email,
    c.company_name AS customer_company_name,
    dp.name AS delivery_partner_name,
    dp.mobile AS delivery_partner_mobile,
    ra.status AS route_assignment_status,
    ra.pickup_time,
    ra.delivery_time,
    ra.delivery_notes,
    ra.collected_payment_method,
    ra.collected_amount,
    ra.customer_rating,
    ra.customer_feedback,
    rt.route_name,
    svc.svc_distributor_id AS serviceable_distributor_id,
    svc.svc_distributor_name AS serviceable_distributor_name
   FROM (((((((orders o
     LEFT JOIN customers c ON ((o.customer_id = c.id)))
     LEFT JOIN distributors d ON ((o.distributor_id = d.id)))
     LEFT JOIN retailers r ON ((o.retailer_id = r.id)))
     LEFT JOIN delivery_partners dp ON ((o.delivery_partner_id = dp.id)))
     LEFT JOIN LATERAL ( SELECT ra2.status,
            ra2.pickup_time,
            ra2.delivery_time,
            ra2.delivery_notes,
            ra2.collected_payment_method,
            ra2.collected_amount,
            ra2.customer_rating,
            ra2.customer_feedback,
            ra2.route_id
           FROM route_assignments ra2
          WHERE (ra2.order_id = o.id)
         LIMIT 1) ra ON (true))
     LEFT JOIN routes rt ON ((rt.id = ra.route_id)))
     LEFT JOIN LATERAL ( SELECT sd.id AS svc_distributor_id,
            sd.name AS svc_distributor_name
           FROM distributors sd
          WHERE ((sd.serviceable_pincodes IS NOT NULL) AND (o.shipping_pincode IS NOT NULL) AND (o.shipping_pincode = ANY (sd.serviceable_pincodes)))
         LIMIT 1) svc ON (true));


-- 4. distributor_payments (from migrations/create_distributor_payments.sql)

-- ============================================================
-- Migration: distributor_payments
-- Date: 2026-07-04
-- Why:
--   Distributors pay bills in part payments, but there was no
--   ledger to record them — orders could only be flipped straight
--   to payment_status = 'completed'. This table records each
--   (part) payment against a distributor order; the UI derives
--   partial/completed status from the sum of payments.
-- Run in the Supabase SQL editor (project jneclnidpacecswqgfyj).
-- ============================================================

CREATE TABLE IF NOT EXISTS distributor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid REFERENCES distributors(id),
  order_id uuid REFERENCES orders(id),
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'cash', -- cash | upi | bank_transfer | cheque | other
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  reference_number text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distributor_payments_order
  ON distributor_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_distributor_payments_distributor
  ON distributor_payments (distributor_id);


-- 5. lab_tests (from migrations/create_lab_tests_table.sql)

-- Lab tests for products (one row per batch test)
create table if not exists public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text, -- snapshot in case product is deleted or name changes
  batch_number text not null,
  sample_code text,
  test_type text not null default 'general' check (
    test_type in ('general','microbial','chemical','nutritional','heavy_metals','physical','shelf_life','other')
  ),
  lab_name text not null,
  lab_reference_no text,
  test_date date not null default current_date,
  report_date date,
  manufacturing_date date,
  expiry_date date,
  sample_quantity text,
  status text not null default 'pending' check (
    status in ('pending','in_progress','passed','failed','conditional')
  ),
  overall_result text,
  tested_by text,
  certificate_url text,
  results jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lab_tests_product_id on public.lab_tests(product_id);
create index if not exists idx_lab_tests_batch_number on public.lab_tests(batch_number);
create index if not exists idx_lab_tests_test_date on public.lab_tests(test_date desc);
create index if not exists idx_lab_tests_status on public.lab_tests(status);
create index if not exists idx_lab_tests_lab_name on public.lab_tests(lab_name);
create index if not exists idx_lab_tests_created_at on public.lab_tests(created_at desc);
create index if not exists idx_lab_tests_expiry_date on public.lab_tests(expiry_date);

-- Reuse set_updated_at() function (created with blogs migration)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lab_tests_updated_at on public.lab_tests;
create trigger trg_lab_tests_updated_at
before update on public.lab_tests
for each row execute function public.set_updated_at();

comment on table public.lab_tests is 'Lab tests performed on product batches';
comment on column public.lab_tests.results is 'Array of {parameter, value, unit, spec_limit, status} objects';
comment on column public.lab_tests.product_name is 'Snapshot of product name at test time';

-- Storage bucket for lab test certificates
insert into storage.buckets (id, name, public)
values ('lab-test-certificates', 'lab-test-certificates', true)
on conflict (id) do nothing;

drop policy if exists "Public read access to lab-test-certificates" on storage.objects;
create policy "Public read access to lab-test-certificates"
on storage.objects for select
using (bucket_id = 'lab-test-certificates');

drop policy if exists "Authenticated upload to lab-test-certificates" on storage.objects;
create policy "Authenticated upload to lab-test-certificates"
on storage.objects for insert
to authenticated
with check (bucket_id = 'lab-test-certificates');

drop policy if exists "Authenticated update lab-test-certificates" on storage.objects;
create policy "Authenticated update lab-test-certificates"
on storage.objects for update
to authenticated
using (bucket_id = 'lab-test-certificates');

drop policy if exists "Authenticated delete lab-test-certificates" on storage.objects;
create policy "Authenticated delete lab-test-certificates"
on storage.objects for delete
to authenticated
using (bucket_id = 'lab-test-certificates');


-- 6. Re-disable RLS on the newly created tables (Supabase auto-enables RLS on new tables)

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
