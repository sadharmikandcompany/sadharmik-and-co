-- Auto-generated runnable schema (converted from database.sql dump)

-- 1. Enum types (inferred from application code, not present in original dump)
DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'half_day', 'leave', 'holiday', 'week_off');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'warehouse', 'customer_support', 'factories', 'main_distributor', 'retailer', 'sub_distributor', 'delivery_driver', 'vendors');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tables (foreign keys stripped to avoid ordering issues)

CREATE TABLE public.accounting_periods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  period_name character varying NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status character varying DEFAULT 'Open'::character varying CHECK (status::text = ANY (ARRAY['Open'::character varying, 'Closed'::character varying]::text[])),
  closed_by uuid,
  closed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accounting_periods_pkey PRIMARY KEY (id)
);

CREATE TABLE public.agent_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id text NOT NULL UNIQUE,
  agent_name text,
  agent_state text NOT NULL,
  agent_mode text,
  phone_number text,
  skill_name text,
  last_action text,
  last_event_time timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_status_pkey PRIMARY KEY (id)
);

CREATE TABLE public.announcement_reads (
  announcement_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcement_reads_pkey PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ap_invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  invoice_number character varying NOT NULL,
  grn_id uuid,
  vendor_id uuid,
  vendor_name character varying,
  invoice_date date NOT NULL,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'paid'::character varying, 'partially_paid'::character varying, 'cancelled'::character varying]::text[])),
  payment_ref character varying,
  journal_id uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ap_invoices_pkey PRIMARY KEY (id)
);

CREATE TABLE public.attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  status attendance_status DEFAULT 'absent'::attendance_status,
  notes text,
  total_hours numeric,
  created_by uuid,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  session_number integer DEFAULT 1,
  session_type text DEFAULT 'work'::text CHECK (session_type = ANY (ARRAY['work'::text, 'break'::text])),
  CONSTRAINT attendance_pkey PRIMARY KEY (id)
);

CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_name character varying NOT NULL,
  account_no character varying NOT NULL,
  ifsc character varying,
  branch character varying,
  account_type character varying DEFAULT 'current'::character varying,
  current_balance numeric DEFAULT 0,
  last_reconciled_date date,
  coa_account_id uuid,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.bank_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL,
  txn_date date NOT NULL,
  value_date date,
  amount numeric NOT NULL,
  txn_type character varying NOT NULL CHECK (txn_type::text = ANY (ARRAY['Dr'::character varying, 'Cr'::character varying]::text[])),
  description text,
  reference character varying,
  matched_journal_id uuid,
  status character varying DEFAULT 'unmatched'::character varying CHECK (status::text = ANY (ARRAY['unmatched'::character varying, 'matched'::character varying, 'ignored'::character varying]::text[])),
  imported_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT bank_transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.call_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  monitor_ucid text NOT NULL UNIQUE,
  caller_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  agent_id text,
  agent_name text,
  agent_phone_number text,
  agent_status text,
  agent_unique_id text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  call_duration interval,
  time_to_answer interval,
  campaign_name text,
  campaign_status text,
  skill text,
  dialed_number text,
  did text,
  phone_name text,
  disposition text,
  hangup_by text,
  audio_file_url text,
  api_key text,
  username text,
  customer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  raw_payload jsonb,
  agent_notes text,
  CONSTRAINT call_history_pkey PRIMARY KEY (id)
);

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  parent_category_id uuid,
  meta_title text,
  meta_description text,
  content text,
  visible_on_frontend boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chart_of_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  name character varying NOT NULL,
  type character varying NOT NULL CHECK (type::text = ANY (ARRAY['Asset'::character varying, 'Liability'::character varying, 'Equity'::character varying, 'Revenue'::character varying, 'Expense'::character varying]::text[])),
  parent_id uuid,
  is_system boolean DEFAULT false,
  gst_category character varying,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.courier_partner_pincodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  courier_partner_id uuid NOT NULL,
  pincode text NOT NULL,
  is_serviceable boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT courier_partner_pincodes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.courier_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  phone text,
  email text,
  website text,
  tracking_url_template text,
  default_delivery_days integer,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT courier_partners_pkey PRIMARY KEY (id)
);

CREATE TABLE public.credit_note_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL,
  item_name text NOT NULL,
  hsn_code text,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'NONE'::text,
  price_per_unit numeric NOT NULL DEFAULT 0,
  price_includes_tax boolean DEFAULT true,
  discount_percent numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_percent numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT credit_note_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.credit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  note_number text NOT NULL,
  party_type text NOT NULL CHECK (party_type = ANY (ARRAY['customer'::text, 'vendor'::text])),
  party_id uuid NOT NULL,
  party_name text NOT NULL,
  party_phone text,
  return_no text,
  invoice_number text,
  invoice_date date,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  state_of_supply text,
  transport_name text,
  delivery_location text,
  vehicle_number text,
  delivery_date date,
  payment_type text DEFAULT 'Cash'::text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  round_off numeric DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  description text,
  image_url text,
  notes text,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT credit_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  mobile_primary text NOT NULL,
  whatsapp_number text,
  mobile_secondary_1 text,
  mobile_secondary_2 text,
  company_name text,
  gst_number text CHECK (gst_number IS NULL OR length(gst_number) = 15),
  is_vip boolean DEFAULT false,
  is_defaulter boolean DEFAULT false,
  is_mandir boolean DEFAULT false,
  shipping_flat_number text,
  shipping_floor_wing text,
  shipping_building_name text NOT NULL,
  shipping_street_area text NOT NULL,
  shipping_landmark text,
  shipping_pincode text NOT NULL,
  shipping_country text DEFAULT 'India'::text,
  shipping_state text NOT NULL,
  shipping_city text NOT NULL,
  billing_same_as_shipping boolean DEFAULT true,
  billing_flat_number text,
  billing_floor_wing text,
  billing_building_name text,
  billing_street_area text,
  billing_landmark text,
  billing_pincode text,
  billing_country text DEFAULT 'India'::text,
  billing_state text,
  billing_city text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  whatsapp_same_as_primary boolean DEFAULT false,
  full_address text,
  vip_number character varying,
  shipping_room_number text,
  shipping_floor text,
  shipping_wing text,
  billing_room_number text,
  billing_floor text,
  billing_wing text,
  pan_card_number character varying CHECK (pan_card_number IS NULL OR length(pan_card_number::text) = 10 AND pan_card_number::text ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'::text),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.customers_backup_20251029 (
  id uuid,
  first_name text,
  last_name text,
  email text,
  mobile_primary text,
  whatsapp_number text,
  mobile_secondary_1 text,
  mobile_secondary_2 text,
  company_name text,
  gst_number text,
  is_vip boolean,
  is_defaulter boolean,
  is_mandir boolean,
  shipping_flat_number text,
  shipping_floor_wing text,
  shipping_building_name text,
  shipping_street_area text,
  shipping_landmark text,
  shipping_pincode text,
  shipping_country text,
  shipping_state text,
  shipping_city text,
  billing_same_as_shipping boolean,
  billing_flat_number text,
  billing_floor_wing text,
  billing_building_name text,
  billing_street_area text,
  billing_landmark text,
  billing_pincode text,
  billing_country text,
  billing_state text,
  billing_city text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  whatsapp_same_as_primary boolean,
  full_address text,
  vip_number character varying,
  shipping_room_number text,
  shipping_floor text,
  shipping_wing text,
  billing_room_number text,
  billing_floor text,
  billing_wing text
);

CREATE TABLE public.daily_cash_reconciliation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reconciliation_date date NOT NULL DEFAULT CURRENT_DATE,
  delivery_partner_id uuid NOT NULL,
  partner_name text NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewer_name text NOT NULL,
  notes_2000 integer DEFAULT 0,
  notes_500 integer DEFAULT 0,
  notes_200 integer DEFAULT 0,
  notes_100 integer DEFAULT 0,
  notes_50 integer DEFAULT 0,
  notes_20 integer DEFAULT 0,
  notes_10 integer DEFAULT 0,
  coins_total numeric DEFAULT 0,
  total_cash_submitted numeric GENERATED ALWAYS AS (((((((((notes_2000 * 2000) + (notes_500 * 500)) + (notes_200 * 200)) + (notes_100 * 100)) + (notes_50 * 50)) + (notes_20 * 20)) + (notes_10 * 10)))::numeric + coins_total) STORED,
  total_cash_expected numeric NOT NULL,
  cash_difference numeric GENERATED ALWAYS AS (total_cash_expected - (((((((((notes_2000 * 2000) + (notes_500 * 500)) + (notes_200 * 200)) + (notes_100 * 100)) + (notes_50 * 50)) + (notes_20 * 20)) + (notes_10 * 10)))::numeric + coins_total)) STORED,
  cheques_submitted jsonb DEFAULT '[]'::jsonb,
  upi_transactions jsonb DEFAULT '[]'::jsonb,
  reconciliation_status text DEFAULT 'pending'::text CHECK (reconciliation_status = ANY (ARRAY['pending'::text, 'completed'::text, 'discrepancy'::text, 'resolved'::text])),
  discrepancy_reason text,
  resolution_notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  driver_signature_url text,
  reviewer_signature_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_cash_reconciliation_pkey PRIMARY KEY (id)
);

CREATE TABLE public.debit_note_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  debit_note_id uuid NOT NULL,
  item_name text NOT NULL,
  hsn_code text,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'NONE'::text,
  price_per_unit numeric NOT NULL DEFAULT 0,
  price_includes_tax boolean DEFAULT true,
  discount_percent numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_percent numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT debit_note_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.debit_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  note_number text NOT NULL,
  party_type text NOT NULL CHECK (party_type = ANY (ARRAY['customer'::text, 'vendor'::text])),
  party_id uuid NOT NULL,
  party_name text NOT NULL,
  party_phone text,
  return_no text,
  bill_number text,
  bill_date date,
  note_date date NOT NULL DEFAULT CURRENT_DATE,
  state_of_supply text,
  transport_name text,
  delivery_location text,
  vehicle_number text,
  delivery_date date,
  payment_type text DEFAULT 'Cash'::text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  round_off numeric DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  description text,
  image_url text,
  notes text,
  status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT debit_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.delivery_partner_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  delivery_partner_id uuid NOT NULL,
  order_id uuid,
  product_id uuid,
  stock_inventory_id uuid,
  product_name text,
  product_sku text,
  variant_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  delivered_quantity integer DEFAULT 0,
  returned_quantity integer DEFAULT 0,
  damaged_quantity integer DEFAULT 0,
  source_godown_id uuid,
  status text NOT NULL DEFAULT 'assigned'::text CHECK (status = ANY (ARRAY['assigned'::text, 'picked_up'::text, 'in_transit'::text, 'delivered'::text, 'partially_delivered'::text, 'returned'::text, 'cancelled'::text])),
  assigned_date timestamp with time zone DEFAULT now(),
  picked_up_date timestamp with time zone,
  delivered_date timestamp with time zone,
  returned_date timestamp with time zone,
  assigned_by_user_id uuid,
  assigned_by_email text,
  route_assignment_id uuid,
  delivery_address text,
  customer_name text,
  customer_phone text,
  delivery_proof_url text,
  customer_signature_url text,
  delivery_photo_url text,
  notes text,
  delivery_notes text,
  return_reason text,
  damage_notes text,
  cod_amount numeric,
  collected_amount numeric,
  payment_method text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_partner_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.delivery_partners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  mobile text NOT NULL,
  partner_code text UNIQUE,
  vehicle_type text,
  vehicle_number text,
  license_number text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  photo_url text,
  license_url text,
  vehicle_rc_url text,
  is_active boolean DEFAULT true,
  is_available boolean DEFAULT true,
  average_rating numeric DEFAULT 0 CHECK (average_rating >= 0::numeric AND average_rating <= 5::numeric),
  total_deliveries integer DEFAULT 0 CHECK (total_deliveries >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  serviceable_pincodes text[] DEFAULT '{}'::text[],
  mobile_secondary_1 text,
  mobile_secondary_2 text,
  flat_number text,
  floor_wing text,
  building_name text,
  street_name text,
  landmark text,
  country text DEFAULT 'India'::text,
  aadhar_number text,
  pan_number text,
  aadhar_card_url text,
  pan_card_url text,
  police_verification_url text,
  assigned_godown_ids uuid[] DEFAULT ARRAY[]::uuid[],
  CONSTRAINT delivery_partners_pkey PRIMARY KEY (id)
);

CREATE TABLE public.delivery_review_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  route_assignment_id uuid NOT NULL UNIQUE,
  order_id uuid NOT NULL,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  delivery_address text NOT NULL,
  delivery_status text NOT NULL,
  reported_delivered_at timestamp with time zone,
  verified_status text CHECK (verified_status = ANY (ARRAY['verified'::text, 'disputed'::text, 'pending'::text])),
  total_items integer DEFAULT 0,
  items_delivered integer DEFAULT 0,
  items_missing integer DEFAULT 0,
  items_damaged integer DEFAULT 0,
  item_discrepancy_notes text,
  order_amount numeric NOT NULL,
  reported_payment_method text,
  reported_collected_amount numeric DEFAULT 0,
  verified_payment_method text,
  verified_amount numeric DEFAULT 0,
  payment_discrepancy numeric DEFAULT 0,
  customer_signature_verified boolean DEFAULT false,
  otp_verified boolean DEFAULT false,
  photo_proof_url text,
  review_notes text,
  dispute_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_review_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.delivery_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  reviewer_id uuid,
  reviewer_name text NOT NULL,
  delivery_partner_id uuid NOT NULL,
  partner_name text NOT NULL,
  route_id uuid,
  route_name text,
  total_deliveries integer DEFAULT 0,
  verified_deliveries integer DEFAULT 0,
  disputed_deliveries integer DEFAULT 0,
  total_items_delivered integer DEFAULT 0,
  items_verified integer DEFAULT 0,
  items_missing integer DEFAULT 0,
  items_damaged integer DEFAULT 0,
  total_cash_expected numeric DEFAULT 0,
  total_cash_collected numeric DEFAULT 0,
  cash_difference numeric DEFAULT 0,
  total_cheque_amount numeric DEFAULT 0,
  total_upi_amount numeric DEFAULT 0,
  total_card_amount numeric DEFAULT 0,
  total_online_amount numeric DEFAULT 0,
  settlement_status text DEFAULT 'pending'::text CHECK (settlement_status = ANY (ARRAY['pending'::text, 'partial'::text, 'complete'::text, 'disputed'::text])),
  settlement_amount numeric DEFAULT 0,
  settlement_method text,
  settlement_reference text,
  settlement_date timestamp with time zone,
  review_notes text,
  discrepancy_notes text,
  review_status text DEFAULT 'in_progress'::text CHECK (review_status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'disputed'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_reviews_pkey PRIMARY KEY (id)
);

CREATE TABLE public.delivery_sheets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  delivery_partner_id uuid NOT NULL,
  route_name text NOT NULL,
  partner_name text NOT NULL,
  partner_phone text,
  assignment_date date NOT NULL,
  generated_date timestamp with time zone DEFAULT now(),
  total_orders integer NOT NULL,
  total_items integer NOT NULL,
  total_amount numeric NOT NULL,
  order_ids uuid[] NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delivery_sheets_pkey PRIMARY KEY (id)
);

CREATE TABLE public.distributors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone_primary text NOT NULL,
  phone_secondary text,
  phone_tertiary text,
  company_name text NOT NULL,
  gst_number text NOT NULL,
  serviceable_pincodes text[] DEFAULT '{}'::text[],
  shipping_address_line1 text NOT NULL,
  shipping_address_line2 text,
  shipping_city text NOT NULL,
  shipping_state text NOT NULL,
  shipping_pincode text NOT NULL,
  shipping_country text DEFAULT 'India'::text,
  billing_address_line1 text NOT NULL,
  billing_address_line2 text,
  billing_city text NOT NULL,
  billing_state text NOT NULL,
  billing_pincode text NOT NULL,
  billing_country text DEFAULT 'India'::text,
  aadhaar_number text,
  pan_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  bank_account_holder_name text,
  bank_branch text,
  aadhaar_card_url text,
  pan_card_url text,
  user_photo_url text,
  payment_qr_code_url text,
  gumasta_license_url text,
  udyog_aadhaar_url text,
  cancelled_cheque_url text,
  bank_passbook_url text,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  parent_id uuid,
  invoice_code text UNIQUE,
  user_id uuid UNIQUE,
  CONSTRAINT distributors_pkey PRIMARY KEY (id)
);

CREATE TABLE public.einvoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  einvoice_id uuid NOT NULL,
  sl_no integer NOT NULL,
  product_name text NOT NULL,
  product_desc text,
  is_service boolean DEFAULT false,
  hsn_code character varying,
  barcode character varying,
  quantity numeric,
  unit character varying DEFAULT 'PCS'::character varying,
  unit_price numeric,
  gross_amount numeric,
  discount_amount numeric DEFAULT 0,
  taxable_value numeric,
  gst_rate numeric,
  igst_amount numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  cess_rate numeric DEFAULT 0,
  cess_amount numeric DEFAULT 0,
  total_item_value numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT einvoice_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.einvoices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  purchase_id uuid,
  invoice_type character varying NOT NULL DEFAULT 'INV'::character varying,
  invoice_number text NOT NULL UNIQUE,
  irn text UNIQUE,
  ack_no bigint,
  ack_dt timestamp with time zone,
  signed_invoice text,
  signed_qr_code text,
  ewb_no text,
  ewb_dt timestamp with time zone,
  ewb_valid_till timestamp with time zone,
  doc_date date NOT NULL,
  supply_type character varying DEFAULT 'B2B'::character varying,
  seller_gstin character varying,
  seller_name text,
  seller_address jsonb,
  buyer_gstin character varying,
  buyer_name text,
  buyer_address jsonb,
  buyer_state_code character varying,
  total_items integer DEFAULT 0,
  assessed_value numeric,
  cgst_value numeric DEFAULT 0,
  sgst_value numeric DEFAULT 0,
  igst_value numeric DEFAULT 0,
  cess_value numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  other_charges numeric DEFAULT 0,
  round_off_amount numeric DEFAULT 0,
  total_invoice_value numeric NOT NULL,
  status character varying DEFAULT 'DRAFT'::character varying,
  cancellation_reason text,
  cancellation_date timestamp with time zone,
  request_payload jsonb,
  response_payload jsonb,
  error_details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT einvoices_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ewaybills (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ewaybill_number text NOT NULL UNIQUE,
  ewaybill_date timestamp with time zone NOT NULL,
  valid_upto timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'active'::text,
  order_id uuid,
  purchase_id uuid,
  supply_type text NOT NULL,
  sub_supply_type text,
  doc_type text NOT NULL,
  doc_number text NOT NULL,
  doc_date date NOT NULL,
  from_gstin text NOT NULL,
  from_trade_name text NOT NULL,
  from_address1 text NOT NULL,
  from_address2 text,
  from_place text NOT NULL,
  from_pincode text NOT NULL,
  from_state_code text NOT NULL,
  to_gstin text NOT NULL,
  to_trade_name text NOT NULL,
  to_address1 text NOT NULL,
  to_address2 text,
  to_place text NOT NULL,
  to_pincode text NOT NULL,
  to_state_code text NOT NULL,
  transporter_id text,
  transporter_name text,
  trans_doc_number text,
  trans_mode text,
  trans_distance text,
  vehicle_number text,
  vehicle_type text,
  total_value numeric NOT NULL,
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  cess_amount numeric DEFAULT 0,
  total_invoice_value numeric NOT NULL,
  api_response jsonb,
  cancelled_at timestamp with time zone,
  cancel_reason_code text,
  cancel_remarks text,
  vehicle_update_history jsonb[],
  created_by_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sub_supply_desc text,
  einvoice_id uuid,
  CONSTRAINT ewaybills_pkey PRIMARY KEY (id)
);

CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  expense_type text NOT NULL CHECK (expense_type = ANY (ARRAY['loan'::text, 'daily_expenses'::text, 'rent'::text, 'utilities'::text, 'salary'::text, 'wages'::text, 'transportation'::text, 'maintenance'::text, 'marketing'::text, 'insurance'::text, 'other'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  description text,
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['cash'::text, 'upi'::text, 'bank_transfer'::text, 'cheque'::text, 'balance'::text, 'card'::text, 'net_banking'::text, 'other'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  added_by uuid,
  CONSTRAINT expenses_pkey PRIMARY KEY (id)
);

CREATE TABLE public.factory_warehouse_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stock_inventory_id uuid NOT NULL UNIQUE,
  product_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity integer GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  min_stock_level integer DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT factory_warehouse_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.godown_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  godown_id uuid NOT NULL,
  stock_inventory_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity integer GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  unit_price numeric,
  rack_number text,
  shelf_number text,
  bin_location text,
  min_stock_level integer DEFAULT 10,
  max_stock_level integer,
  last_stock_in_date timestamp with time zone,
  last_stock_out_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT godown_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.godowns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  godown_code text NOT NULL UNIQUE,
  godown_type text NOT NULL CHECK (godown_type = ANY (ARRAY['company'::text, 'distributor'::text, 'retailer'::text])),
  distributor_id uuid,
  retailer_id uuid,
  address_line1 text,
  address_line2 text,
  building text,
  street text,
  landmark text,
  city text,
  state text,
  pincode text,
  country text DEFAULT 'India'::text,
  manager_name text,
  manager_phone text,
  manager_email text,
  total_capacity_sqft numeric,
  storage_type text,
  latitude numeric,
  longitude numeric,
  operating_hours text,
  notes text,
  is_active boolean DEFAULT true,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  serviceable_pincodes text,
  CONSTRAINT godowns_pkey PRIMARY KEY (id)
);

CREATE TABLE public.goods_receipt_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grn_number character varying UNIQUE,
  purchase_id uuid,
  vendor_id uuid,
  vendor_name character varying,
  received_date date NOT NULL,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'qc_hold'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  discrepancy_notes text,
  remarks text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT goods_receipt_notes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.grn_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL,
  product_id uuid,
  variant_id uuid,
  expected_qty numeric DEFAULT 0,
  received_qty numeric DEFAULT 0,
  accepted_qty numeric DEFAULT 0,
  rejected_qty numeric DEFAULT 0,
  rate numeric DEFAULT 0,
  batch_id uuid,
  remarks text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grn_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entry_number character varying UNIQUE,
  entry_date date NOT NULL,
  narration text,
  reference_type character varying,
  reference_id uuid,
  status character varying DEFAULT 'Draft'::character varying CHECK (status::text = ANY (ARRAY['Draft'::character varying, 'Posted'::character varying, 'Reversed'::character varying]::text[])),
  total_debit numeric NOT NULL DEFAULT 0,
  total_credit numeric NOT NULL DEFAULT 0,
  created_by uuid,
  posted_by uuid,
  posted_at timestamp with time zone,
  period_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journal_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE public.journal_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  journal_id uuid NOT NULL,
  account_id uuid NOT NULL,
  debit numeric DEFAULT 0,
  credit numeric DEFAULT 0,
  narration text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journal_lines_pkey PRIMARY KEY (id)
);

CREATE TABLE public.live_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id text NOT NULL UNIQUE,
  phone_number text NOT NULL,
  agent_id text,
  agent_name text,
  call_state text NOT NULL,
  event_type text,
  started_at timestamp with time zone DEFAULT now(),
  connected_at timestamp with time zone,
  ended_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  raw_data jsonb,
  CONSTRAINT live_calls_pkey PRIMARY KEY (id)
);

CREATE TABLE public.loose_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL UNIQUE,
  quantity_liters numeric NOT NULL DEFAULT 0 CHECK (quantity_liters >= 0::numeric),
  price_per_liter numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT loose_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.loose_stock_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  loose_stock_id uuid NOT NULL,
  transaction_type character varying NOT NULL CHECK (transaction_type::text = ANY (ARRAY['purchase'::character varying, 'transfer'::character varying, 'adjustment'::character varying]::text[])),
  quantity_liters numeric NOT NULL,
  price_per_liter numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  vendor_id uuid,
  vendor_name character varying,
  transferred_to_stock_id uuid,
  invoice_number character varying,
  batch_number character varying,
  transaction_notes text,
  user_id uuid,
  user_email character varying,
  transaction_date timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  purchase_id uuid,
  CONSTRAINT loose_stock_transactions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.myoperator_call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id text NOT NULL UNIQUE,
  caller_number text NOT NULL,
  called_number text,
  direction text,
  status text,
  duration integer DEFAULT 0,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  agent_name text,
  agent_number text,
  agent_id text,
  recording_url text,
  department text,
  disposition text,
  disposition_code text,
  disposition_comments text,
  disposition_at timestamp with time zone,
  customer_id uuid,
  raw_payload jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  caller_number_formatted text,
  caller_name text,
  caller_country_code text,
  caller_location text,
  status_code integer,
  duration_minutes numeric,
  log_timestamp timestamp with time zone,
  agent_email text,
  recording_file_name text,
  department_id text,
  call_type text,
  source text,
  notification_type text,
  uid text,
  is_anonymous boolean DEFAULT false,
  reference_id text,
  obd_job_id text,
  client_reference_id text,
  CONSTRAINT myoperator_call_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.myoperator_latest_call (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  phone_number text,
  call_id text,
  agent_id text,
  agent_name text,
  direction text,
  timestamp timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT myoperator_latest_call_pkey PRIMARY KEY (id)
);

CREATE TABLE public.myoperator_live_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  call_id text NOT NULL UNIQUE,
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
  CONSTRAINT myoperator_live_calls_pkey PRIMARY KEY (id)
);

CREATE TABLE public.myoperator_whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  direction text CHECK (direction = ANY (ARRAY['incoming'::text, 'outgoing'::text])),
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
  CONSTRAINT myoperator_whatsapp_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.order_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  assignment_id uuid,
  delivery_partner_id uuid,
  request_type text NOT NULL CHECK (request_type = ANY (ARRAY['item_change'::text, 'quantity_change'::text, 'address_change'::text, 'other'::text])),
  request_status text NOT NULL DEFAULT 'pending'::text CHECK (request_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])),
  requested_changes jsonb NOT NULL,
  reason text NOT NULL,
  driver_notes text,
  admin_notes text,
  admin_response text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid,
  CONSTRAINT order_change_requests_pkey PRIMARY KEY (id)
);

CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  product_sku text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  discount_percent numeric DEFAULT 0 CHECK (discount_percent >= 0::numeric AND discount_percent <= 100::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  hsn_code text,
  gst_percentage numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  total numeric NOT NULL CHECK (total >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid,
  distributor_id uuid,
  order_status text NOT NULL DEFAULT 'pending'::text CHECK (order_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'packed'::text, 'shipped'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text, 'returned'::text, 'refunded'::text, 'failed'::text])),
  payment_status text NOT NULL DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text])),
  payment_method text,
  transaction_id text,
  shipping_flat_number text,
  shipping_floor_wing text,
  shipping_building_name text,
  shipping_street_area text,
  shipping_landmark text,
  shipping_pincode text,
  shipping_country text DEFAULT 'India'::text,
  shipping_state text,
  shipping_city text,
  billing_flat_number text,
  billing_floor_wing text,
  billing_building_name text NOT NULL,
  billing_street_area text NOT NULL,
  billing_landmark text,
  billing_pincode text NOT NULL,
  billing_country text DEFAULT 'India'::text,
  billing_state text NOT NULL,
  billing_city text NOT NULL,
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  tax_amount numeric DEFAULT 0 CHECK (tax_amount >= 0::numeric),
  gst_amount numeric DEFAULT 0 CHECK (gst_amount >= 0::numeric),
  shipping_charges numeric DEFAULT 0 CHECK (shipping_charges >= 0::numeric),
  total_amount numeric NOT NULL CHECK (total_amount >= 0::numeric),
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  shipping_method text,
  tracking_number text,
  courier_partner text,
  expected_delivery_date date,
  shipped_date timestamp with time zone,
  delivered_date timestamp with time zone,
  order_notes text,
  customer_notes text,
  internal_notes text,
  is_priority boolean DEFAULT false,
  order_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by_user_id uuid,
  created_by_agent_id text,
  created_by_agent_name text,
  shipping_full_address text,
  billing_full_address text,
  shipping_room_number text,
  shipping_floor text,
  shipping_wing text,
  billing_room_number text,
  billing_floor text,
  billing_wing text,
  invoice_number_gst text,
  invoice_number_non_gst text,
  is_gst_invoice boolean DEFAULT false,
  source text NOT NULL DEFAULT 'backend'::text CHECK (source = ANY (ARRAY['online'::text, 'backend'::text, 'website'::text, 'mobile'::text])),
  is_distributor boolean DEFAULT false,
  is_subdistributor boolean DEFAULT false,
  delivery_partner_id uuid,
  assigned_to_delivery_at timestamp with time zone,
  retailer_id uuid,
  customer_gst_number character varying,
  customer_pan_number character varying,
  cod_amount numeric DEFAULT 0,
  failed_at timestamp with time zone,
  failure_reason text,
  failed_attempts integer DEFAULT 0,
  cancelled_at timestamp with time zone,
  next_delivery_at timestamp with time zone,
  customer_first_name text,
  customer_last_name text,
  customer_full_name text,
  source_godown_id uuid,
  cancellation_reason text,
  cancelled_by uuid,
  delivery_status text DEFAULT 'not_assigned'::text,
  cod_collected_amount text,
  cod_payment_method text,
  delivery_proof_url text,
  customer_signature_url text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  easebuzz_txn_id text,
  company_name text,
  cheque_number text,
  destination_godown_id uuid,
  CONSTRAINT orders_pkey PRIMARY KEY (id)
);

CREATE TABLE public.packaging_materials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  material_type text NOT NULL DEFAULT 'packaging'::text CHECK (material_type = ANY (ARRAY['content'::text, 'packaging'::text])),
  CONSTRAINT packaging_materials_pkey PRIMARY KEY (id)
);

CREATE TABLE public.payment_outs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  payment_type text NOT NULL CHECK (payment_type = ANY (ARRAY['cash'::text, 'upi'::text, 'bank_transfer'::text, 'cheque'::text, 'card'::text, 'net_banking'::text, 'other'::text])),
  description text,
  paid_amount numeric NOT NULL CHECK (paid_amount > 0::numeric),
  discount_percent numeric DEFAULT 0 CHECK (discount_percent >= 0::numeric AND discount_percent <= 100::numeric),
  final_amount numeric GENERATED ALWAYS AS (paid_amount - ((paid_amount * discount_percent) / (100)::numeric)) STORED,
  image_proof_url text,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_outs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT product_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.product_pincode_pricing (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  pincode text NOT NULL,
  customer_price numeric CHECK (customer_price IS NULL OR customer_price >= 0::numeric),
  customer_sale_price numeric CHECK (customer_sale_price IS NULL OR customer_sale_price >= 0::numeric),
  retailer_price numeric CHECK (retailer_price IS NULL OR retailer_price >= 0::numeric),
  retailer_sale_price numeric CHECK (retailer_sale_price IS NULL OR retailer_sale_price >= 0::numeric),
  distributor_price numeric CHECK (distributor_price IS NULL OR distributor_price >= 0::numeric),
  distributor_sale_price numeric CHECK (distributor_sale_price IS NULL OR distributor_sale_price >= 0::numeric),
  sub_distributor_price numeric CHECK (sub_distributor_price IS NULL OR sub_distributor_price >= 0::numeric),
  sub_distributor_sale_price numeric CHECK (sub_distributor_sale_price IS NULL OR sub_distributor_sale_price >= 0::numeric),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_pincode_pricing_pkey PRIMARY KEY (id)
);

CREATE TABLE public.product_variants (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  category_id uuid,
  variant_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  product_id uuid,
  CONSTRAINT product_variants_pkey PRIMARY KEY (id)
);

CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text,
  hsn_code text,
  gst_percentage numeric CHECK (gst_percentage >= 0::numeric AND gst_percentage <= 100::numeric),
  stock integer DEFAULT 0 CHECK (stock >= 0),
  customer_price numeric NOT NULL CHECK (customer_price >= 0::numeric),
  customer_sale_price numeric CHECK (customer_sale_price >= 0::numeric),
  customer_discount_percent numeric CHECK (customer_discount_percent >= 0::numeric AND customer_discount_percent <= 100::numeric),
  retailer_price numeric CHECK (retailer_price >= 0::numeric),
  retailer_sale_price numeric CHECK (retailer_sale_price >= 0::numeric),
  retailer_discount_percent numeric CHECK (retailer_discount_percent >= 0::numeric AND retailer_discount_percent <= 100::numeric),
  distributor_price numeric CHECK (distributor_price >= 0::numeric),
  distributor_sale_price numeric CHECK (distributor_sale_price >= 0::numeric),
  distributor_discount_percent numeric CHECK (distributor_discount_percent >= 0::numeric AND distributor_discount_percent <= 100::numeric),
  sub_distributor_price numeric CHECK (sub_distributor_price >= 0::numeric),
  sub_distributor_sale_price numeric CHECK (sub_distributor_sale_price >= 0::numeric),
  sub_distributor_discount_percent numeric CHECK (sub_distributor_discount_percent >= 0::numeric AND sub_distributor_discount_percent <= 100::numeric),
  short_description text,
  long_description text,
  images text[] DEFAULT '{}'::text[],
  specifications jsonb DEFAULT '[]'::jsonb,
  available_offers jsonb DEFAULT '[]'::jsonb,
  questions_answers jsonb DEFAULT '[]'::jsonb,
  meta_title text,
  meta_description text,
  meta_content text,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  parent_category_id uuid,
  sub_category_id uuid,
  material_mapping_id uuid,
  sku text,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);

CREATE TABLE public.purchase_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  product_id uuid,
  product_name text NOT NULL,
  product_sku text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0::numeric),
  discount_percent numeric DEFAULT 0 CHECK (discount_percent >= 0::numeric AND discount_percent <= 100::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  hsn_code text,
  gst_percentage numeric DEFAULT 0,
  gst_amount numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  total numeric NOT NULL CHECK (total >= 0::numeric),
  received_quantity integer DEFAULT 0 CHECK (received_quantity >= 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  stock_inventory_id uuid,
  CONSTRAINT purchase_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  purchase_number text NOT NULL UNIQUE,
  supplier_id uuid,
  distributor_id uuid,
  purchase_status text NOT NULL DEFAULT 'pending'::text CHECK (purchase_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'received'::text, 'partially_received'::text, 'cancelled'::text, 'returned'::text])),
  payment_status text NOT NULL DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'partial'::text])),
  payment_method text,
  transaction_id text,
  supplier_name text NOT NULL,
  supplier_email text,
  supplier_phone text,
  supplier_address_line1 text,
  supplier_address_line2 text,
  supplier_city text,
  supplier_state text,
  supplier_pincode text,
  supplier_country text DEFAULT 'India'::text,
  supplier_gst_number text,
  subtotal numeric NOT NULL CHECK (subtotal >= 0::numeric),
  discount_amount numeric DEFAULT 0 CHECK (discount_amount >= 0::numeric),
  tax_amount numeric DEFAULT 0 CHECK (tax_amount >= 0::numeric),
  gst_amount numeric DEFAULT 0 CHECK (gst_amount >= 0::numeric),
  cgst_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  shipping_charges numeric DEFAULT 0 CHECK (shipping_charges >= 0::numeric),
  other_charges numeric DEFAULT 0 CHECK (other_charges >= 0::numeric),
  total_amount numeric NOT NULL CHECK (total_amount >= 0::numeric),
  shipping_method text,
  tracking_number text,
  courier_partner text,
  expected_delivery_date date,
  shipped_date timestamp with time zone,
  received_date timestamp with time zone,
  purchase_notes text,
  internal_notes text,
  terms_and_conditions text,
  invoice_number text,
  invoice_date date,
  invoice_url text,
  is_urgent boolean DEFAULT false,
  purchase_date timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  vendor_id uuid,
  paid_amount numeric DEFAULT 0 CHECK (paid_amount >= 0::numeric),
  remaining_amount numeric GENERATED ALWAYS AS (total_amount - COALESCE(paid_amount, (0)::numeric)) STORED,
  batch_number text,
  CONSTRAINT purchases_pkey PRIMARY KEY (id)
);

CREATE TABLE public.reorder_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  variant_id uuid,
  warehouse_id uuid,
  reorder_point numeric NOT NULL DEFAULT 0,
  reorder_qty numeric NOT NULL DEFAULT 0,
  preferred_vendor_id uuid,
  auto_po boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reorder_rules_pkey PRIMARY KEY (id)
);

CREATE TABLE public.retailers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  distributor_id uuid,
  name text NOT NULL,
  email text UNIQUE,
  company_name text,
  gst_number text UNIQUE,
  phone_primary text,
  phone_secondary text,
  phone_tertiary text,
  whatsapp_number text,
  contact_person text,
  shipping_room_number text,
  shipping_flat_number text,
  shipping_floor_number text,
  shipping_wing text,
  shipping_building text,
  shipping_street text,
  shipping_landmark text,
  shipping_city text,
  shipping_state text,
  shipping_pincode text,
  shipping_country text DEFAULT 'India'::text,
  billing_room_number text,
  billing_flat_number text,
  billing_floor_number text,
  billing_wing text,
  billing_building text,
  billing_street text,
  billing_landmark text,
  billing_city text,
  billing_state text,
  billing_pincode text,
  billing_country text DEFAULT 'India'::text,
  billing_same_as_shipping boolean DEFAULT true,
  aadhaar_number text,
  pan_number text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  bank_account_holder_name text,
  bank_branch text,
  aadhaar_front_url text,
  aadhaar_back_url text,
  pan_card_url text,
  photo_url text,
  gst_certificate_url text,
  cancelled_cheque_url text,
  shop_license_url text,
  trade_license_url text,
  credit_limit numeric DEFAULT 0,
  credit_days integer DEFAULT 0,
  serviceable_pincodes text[],
  retailer_code text UNIQUE,
  is_active boolean DEFAULT true,
  is_verified boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid UNIQUE,
  CONSTRAINT retailers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.route_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  delivery_partner_id uuid,
  assignment_date timestamp with time zone DEFAULT now(),
  scheduled_delivery_date date,
  sequence_number integer,
  status text NOT NULL DEFAULT 'assigned'::text CHECK (status = ANY (ARRAY['assigned'::text, 'picked_up'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text, 'failed'::text, 'returned'::text, 'cancelled'::text])),
  pickup_time timestamp with time zone,
  delivery_time timestamp with time zone,
  delivery_notes text,
  delivery_proof_url text,
  current_latitude numeric,
  current_longitude numeric,
  last_location_update timestamp with time zone,
  customer_rating integer CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_feedback text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  next_delivery_attempt timestamp with time zone,
  collected_payment_method text,
  collected_amount numeric,
  failure_reason text,
  customer_signature_url text,
  delivery_latitude double precision,
  delivery_longitude double precision,
  cheque_number text,
  CONSTRAINT route_assignments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.routes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  route_name text NOT NULL,
  city text NOT NULL,
  pincodes text[] NOT NULL DEFAULT '{}'::text[] CHECK (array_length(pincodes, 1) > 0),
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT routes_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  variant_id uuid,
  warehouse_id uuid,
  batch_no character varying NOT NULL,
  mfg_date date,
  expiry_date date,
  qty numeric DEFAULT 0,
  rate numeric DEFAULT 0,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'expired'::character varying, 'consumed'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_batches_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  stock_inventory_id uuid NOT NULL,
  user_id uuid,
  user_email text,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL,
  quantity_change integer NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT stock_comments_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_dispatch_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stock_dispatch_id uuid NOT NULL,
  stock_inventory_id uuid NOT NULL,
  quantity integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_dispatch_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_dispatches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  dispatch_number text NOT NULL UNIQUE,
  to_godown_id uuid NOT NULL,
  dispatch_status text DEFAULT 'completed'::text,
  dispatched_by_user_id uuid,
  dispatched_by_email text,
  dispatch_date timestamp with time zone DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_dispatches_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_inventory (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  variant_id uuid NOT NULL,
  material_id uuid,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_stock integer NOT NULL DEFAULT 10 CHECK (min_stock >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  price numeric DEFAULT 0 CHECK (price >= 0::numeric),
  product_id uuid,
  CONSTRAINT stock_inventory_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  variant_id uuid,
  warehouse_id uuid,
  txn_type character varying NOT NULL CHECK (txn_type::text = ANY (ARRAY['PURCHASE_RECEIPT'::character varying, 'SALE_ISSUE'::character varying, 'TRANSFER_IN'::character varying, 'TRANSFER_OUT'::character varying, 'ADJUSTMENT'::character varying, 'WRITE_OFF'::character varying, 'OPENING_BALANCE'::character varying, 'RETURN_IN'::character varying, 'RETURN_OUT'::character varying, 'PRODUCTION_IN'::character varying, 'PRODUCTION_OUT'::character varying]::text[])),
  qty numeric NOT NULL,
  rate numeric DEFAULT 0,
  amount numeric DEFAULT 0,
  reference_type character varying,
  reference_id uuid,
  balance_qty numeric DEFAULT 0,
  balance_value numeric DEFAULT 0,
  batch_id uuid,
  narration text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_ledger_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_transfer_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  stock_transfer_id uuid NOT NULL,
  stock_inventory_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_transfer_items_pkey PRIMARY KEY (id)
);

CREATE TABLE public.stock_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transfer_number text NOT NULL UNIQUE,
  from_godown_id uuid NOT NULL,
  to_godown_id uuid NOT NULL,
  stock_inventory_id uuid,
  quantity integer CHECK (quantity > 0),
  transfer_status text NOT NULL DEFAULT 'pending'::text CHECK (transfer_status = ANY (ARRAY['pending'::text, 'in_transit'::text, 'completed'::text, 'cancelled'::text, 'rejected'::text])),
  requested_date timestamp with time zone DEFAULT now(),
  approved_date timestamp with time zone,
  shipped_date timestamp with time zone,
  received_date timestamp with time zone,
  completed_date timestamp with time zone,
  requested_by_user_id uuid,
  requested_by_email text,
  approved_by_user_id uuid,
  approved_by_email text,
  received_by_user_id uuid,
  received_by_email text,
  vehicle_number text,
  driver_name text,
  driver_phone text,
  tracking_number text,
  transfer_invoice_url text,
  receipt_url text,
  transfer_reason text,
  notes text,
  rejection_reason text,
  is_urgent boolean DEFAULT false,
  expected_delivery_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_transfers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL,
  order_id uuid,
  subject text NOT NULL,
  description text NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['order_issue'::text, 'delivery_issue'::text, 'product_inquiry'::text, 'payment_issue'::text, 'refund_request'::text, 'complaint'::text, 'technical_issue'::text, 'account_issue'::text, 'feedback'::text, 'other'::text])),
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text, 'critical'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'pending_customer'::text, 'on_hold'::text, 'resolved'::text, 'closed'::text, 'cancelled'::text])),
  assigned_to text,
  assigned_at timestamp with time zone,
  resolution text,
  resolved_at timestamp with time zone,
  resolved_by text,
  satisfaction_rating integer CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback text,
  attachments text[] DEFAULT '{}'::text[],
  tags text[] DEFAULT '{}'::text[],
  first_response_at timestamp with time zone,
  first_response_time_minutes integer,
  resolution_time_minutes integer,
  source text DEFAULT 'web'::text CHECK (source = ANY (ARRAY['web'::text, 'mobile'::text, 'email'::text, 'phone'::text, 'chat'::text, 'social_media'::text, 'whatsapp'::text])),
  is_escalated boolean DEFAULT false,
  escalated_at timestamp with time zone,
  escalated_to text,
  escalation_reason text,
  internal_notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id)
);

CREATE TABLE public.tax_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  txn_date date NOT NULL,
  txn_type character varying NOT NULL,
  reference_type character varying,
  reference_id uuid,
  party_name character varying,
  gstin character varying,
  hsn character varying,
  taxable_value numeric DEFAULT 0,
  cgst_rate numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  sgst_rate numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  igst_rate numeric DEFAULT 0,
  igst_amount numeric DEFAULT 0,
  cess_amount numeric DEFAULT 0,
  total_tax numeric DEFAULT 0,
  invoice_number character varying,
  is_b2b boolean DEFAULT false,
  state_code character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tax_ledger_pkey PRIMARY KEY (id)
);

CREATE TABLE public.ticket_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  message text NOT NULL,
  sender_type text NOT NULL CHECK (sender_type = ANY (ARRAY['customer'::text, 'agent'::text, 'system'::text, 'bot'::text])),
  sender_name text,
  sender_email text,
  attachments text[] DEFAULT '{}'::text[],
  is_internal boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ticket_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_agent_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  agent_id text NOT NULL,
  agent_name text,
  campaign_name text NOT NULL,
  skills text[] DEFAULT '{}'::text[],
  agent_modes text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone_name text,
  CONSTRAINT user_agent_config_pkey PRIMARY KEY (id)
);

CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  role user_role NOT NULL DEFAULT 'customer_support'::user_role,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  delivery_partner_id uuid,
  address text,
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE public.variant_material_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL,
  material_id uuid NOT NULL,
  quantity_per_unit numeric NOT NULL DEFAULT 1 CHECK (quantity_per_unit > 0::numeric),
  liters_consumed_per_unit numeric NOT NULL DEFAULT 0 CHECK (liters_consumed_per_unit >= 0::numeric),
  is_required boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  product_id uuid,
  CONSTRAINT variant_material_mapping_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vendor_loose_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  category_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT vendor_loose_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vendor_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  stock_inventory_id uuid NOT NULL,
  vendor_price numeric CHECK (vendor_price >= 0::numeric),
  is_primary_supplier boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vendor_stock_pkey PRIMARY KEY (id)
);

CREATE TABLE public.vendors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_name text NOT NULL,
  contact_person text,
  email text UNIQUE CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text),
  mobile_primary text NOT NULL,
  whatsapp_number text,
  whatsapp_same_as_primary boolean DEFAULT false,
  mobile_secondary_1 text,
  mobile_secondary_2 text,
  company_name text,
  gst_number text CHECK (gst_number IS NULL OR length(gst_number) = 15),
  pan_number text,
  vendor_type text CHECK (vendor_type = ANY (ARRAY['manufacturer'::text, 'wholesaler'::text, 'distributor'::text, 'trader'::text, 'importer'::text, 'other'::text])),
  is_verified boolean DEFAULT false,
  is_preferred boolean DEFAULT false,
  credit_days integer DEFAULT 0 CHECK (credit_days >= 0),
  credit_limit numeric DEFAULT 0 CHECK (credit_limit >= 0::numeric),
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  country text DEFAULT 'India'::text,
  bank_name text,
  bank_account_number text,
  bank_ifsc_code text,
  bank_account_holder_name text,
  bank_branch text,
  gst_certificate_url text,
  pan_card_url text,
  cancelled_cheque_url text,
  msme_certificate_url text,
  vendor_notes text,
  internal_notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  transport_vehicle text,
  transporter_name text,
  transporter_number text,
  user_id uuid UNIQUE,
  distributor_id uuid,
  CONSTRAINT vendors_pkey PRIMARY KEY (id)
);

-- 3. Foreign key constraints (added after all tables exist)

ALTER TABLE public.accounting_periods ADD CONSTRAINT accounting_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id);
ALTER TABLE public.announcement_reads ADD CONSTRAINT announcement_reads_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id);
ALTER TABLE public.announcement_reads ADD CONSTRAINT announcement_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.announcements ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.ap_invoices ADD CONSTRAINT ap_invoices_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);
ALTER TABLE public.ap_invoices ADD CONSTRAINT ap_invoices_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id);
ALTER TABLE public.ap_invoices ADD CONSTRAINT ap_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
ALTER TABLE public.bank_accounts ADD CONSTRAINT bank_accounts_coa_account_id_fkey FOREIGN KEY (coa_account_id) REFERENCES public.chart_of_accounts(id);
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id);
ALTER TABLE public.bank_transactions ADD CONSTRAINT bank_transactions_matched_journal_id_fkey FOREIGN KEY (matched_journal_id) REFERENCES public.journal_entries(id);
ALTER TABLE public.call_history ADD CONSTRAINT call_history_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE public.categories ADD CONSTRAINT fk_parent_category FOREIGN KEY (parent_category_id) REFERENCES public.categories(id);
ALTER TABLE public.chart_of_accounts ADD CONSTRAINT chart_of_accounts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.chart_of_accounts(id);
ALTER TABLE public.courier_partner_pincodes ADD CONSTRAINT courier_partner_pincodes_courier_partner_id_fkey FOREIGN KEY (courier_partner_id) REFERENCES public.courier_partners(id);
ALTER TABLE public.credit_note_items ADD CONSTRAINT credit_note_items_credit_note_id_fkey FOREIGN KEY (credit_note_id) REFERENCES public.credit_notes(id);
ALTER TABLE public.daily_cash_reconciliation ADD CONSTRAINT daily_cash_reconciliation_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.daily_cash_reconciliation ADD CONSTRAINT daily_cash_reconciliation_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id);
ALTER TABLE public.daily_cash_reconciliation ADD CONSTRAINT daily_cash_reconciliation_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id);
ALTER TABLE public.debit_note_items ADD CONSTRAINT debit_note_items_debit_note_id_fkey FOREIGN KEY (debit_note_id) REFERENCES public.debit_notes(id);
ALTER TABLE public.delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_route_assignment_id_fkey FOREIGN KEY (route_assignment_id) REFERENCES public.route_assignments(id);
ALTER TABLE public.delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_source_godown_id_fkey FOREIGN KEY (source_godown_id) REFERENCES public.godowns(id);
ALTER TABLE public.delivery_review_items ADD CONSTRAINT delivery_review_items_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.delivery_reviews(id);
ALTER TABLE public.delivery_review_items ADD CONSTRAINT delivery_review_items_route_assignment_id_fkey FOREIGN KEY (route_assignment_id) REFERENCES public.route_assignments(id);
ALTER TABLE public.delivery_review_items ADD CONSTRAINT delivery_review_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.delivery_reviews ADD CONSTRAINT delivery_reviews_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);
ALTER TABLE public.delivery_reviews ADD CONSTRAINT delivery_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id);
ALTER TABLE public.delivery_reviews ADD CONSTRAINT delivery_reviews_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.delivery_sheets ADD CONSTRAINT delivery_sheets_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);
ALTER TABLE public.delivery_sheets ADD CONSTRAINT delivery_sheets_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.distributors ADD CONSTRAINT distributors_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.distributors(id);
ALTER TABLE public.distributors ADD CONSTRAINT distributors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.einvoice_items ADD CONSTRAINT einvoice_items_einvoice_id_fkey FOREIGN KEY (einvoice_id) REFERENCES public.einvoices(id);
ALTER TABLE public.einvoices ADD CONSTRAINT einvoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.einvoices ADD CONSTRAINT einvoices_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);
ALTER TABLE public.ewaybills ADD CONSTRAINT ewaybills_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.ewaybills ADD CONSTRAINT ewaybills_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);
ALTER TABLE public.ewaybills ADD CONSTRAINT ewaybills_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);
ALTER TABLE public.ewaybills ADD CONSTRAINT ewaybills_einvoice_id_fkey FOREIGN KEY (einvoice_id) REFERENCES public.einvoices(id);
ALTER TABLE public.expenses ADD CONSTRAINT expenses_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);
ALTER TABLE public.factory_warehouse_stock ADD CONSTRAINT factory_warehouse_stock_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.factory_warehouse_stock ADD CONSTRAINT factory_warehouse_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.godown_stock ADD CONSTRAINT godown_stock_godown_id_fkey FOREIGN KEY (godown_id) REFERENCES public.godowns(id);
ALTER TABLE public.godown_stock ADD CONSTRAINT godown_stock_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.godowns ADD CONSTRAINT godowns_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
ALTER TABLE public.godowns ADD CONSTRAINT godowns_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.retailers(id);
ALTER TABLE public.goods_receipt_notes ADD CONSTRAINT goods_receipt_notes_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);
ALTER TABLE public.goods_receipt_notes ADD CONSTRAINT goods_receipt_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.goods_receipt_notes ADD CONSTRAINT goods_receipt_notes_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);
ALTER TABLE public.grn_items ADD CONSTRAINT grn_items_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.goods_receipt_notes(id);
ALTER TABLE public.grn_items ADD CONSTRAINT grn_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.grn_items ADD CONSTRAINT grn_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public.grn_items ADD CONSTRAINT grn_items_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.stock_batches(id);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_posted_by_fkey FOREIGN KEY (posted_by) REFERENCES public.users(id);
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.accounting_periods(id);
ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journal_entries(id);
ALTER TABLE public.journal_lines ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);
ALTER TABLE public.loose_stock ADD CONSTRAINT loose_stock_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id);
ALTER TABLE public.loose_stock_transactions ADD CONSTRAINT loose_stock_transactions_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);
ALTER TABLE public.loose_stock_transactions ADD CONSTRAINT loose_stock_transactions_loose_stock_id_fkey FOREIGN KEY (loose_stock_id) REFERENCES public.loose_stock(id);
ALTER TABLE public.loose_stock_transactions ADD CONSTRAINT loose_stock_transactions_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE public.loose_stock_transactions ADD CONSTRAINT loose_stock_transactions_transferred_to_stock_id_fkey FOREIGN KEY (transferred_to_stock_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.myoperator_call_logs ADD CONSTRAINT myoperator_call_logs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE public.myoperator_whatsapp_messages ADD CONSTRAINT myoperator_whatsapp_messages_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.route_assignments(id);
ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.order_change_requests ADD CONSTRAINT order_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);
ALTER TABLE public.order_items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.order_items ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.orders ADD CONSTRAINT fk_distributor FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES public.retailers(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_source_godown_id_fkey FOREIGN KEY (source_godown_id) REFERENCES public.godowns(id);
ALTER TABLE public.orders ADD CONSTRAINT orders_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.users(id);
ALTER TABLE public.payment_outs ADD CONSTRAINT fk_payment_out_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE public.product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id);
ALTER TABLE public.product_variants ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.products ADD CONSTRAINT products_parent_category_id_fkey FOREIGN KEY (parent_category_id) REFERENCES public.categories(id);
ALTER TABLE public.products ADD CONSTRAINT products_sub_category_id_fkey FOREIGN KEY (sub_category_id) REFERENCES public.categories(id);
ALTER TABLE public.products ADD CONSTRAINT products_material_mapping_id_fkey FOREIGN KEY (material_mapping_id) REFERENCES public.variant_material_mapping(id);
ALTER TABLE public.purchase_items ADD CONSTRAINT fk_purchase FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);
ALTER TABLE public.purchase_items ADD CONSTRAINT fk_product_purchase FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.purchases ADD CONSTRAINT fk_purchase_distributor FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
ALTER TABLE public.purchases ADD CONSTRAINT fk_purchase_vendor FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE public.reorder_rules ADD CONSTRAINT reorder_rules_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.reorder_rules ADD CONSTRAINT reorder_rules_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public.reorder_rules ADD CONSTRAINT reorder_rules_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.godowns(id);
ALTER TABLE public.retailers ADD CONSTRAINT retailers_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
ALTER TABLE public.retailers ADD CONSTRAINT retailers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.route_assignments ADD CONSTRAINT fk_route FOREIGN KEY (route_id) REFERENCES public.routes(id);
ALTER TABLE public.route_assignments ADD CONSTRAINT fk_order_assignment FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.route_assignments ADD CONSTRAINT fk_delivery_partner FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.stock_batches ADD CONSTRAINT stock_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.stock_batches ADD CONSTRAINT stock_batches_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public.stock_batches ADD CONSTRAINT stock_batches_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.godowns(id);
ALTER TABLE public.stock_comments ADD CONSTRAINT stock_comments_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.stock_comments ADD CONSTRAINT stock_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.stock_dispatch_items ADD CONSTRAINT stock_dispatch_items_stock_dispatch_id_fkey FOREIGN KEY (stock_dispatch_id) REFERENCES public.stock_dispatches(id);
ALTER TABLE public.stock_dispatch_items ADD CONSTRAINT stock_dispatch_items_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.stock_dispatches ADD CONSTRAINT stock_dispatches_to_godown_id_fkey FOREIGN KEY (to_godown_id) REFERENCES public.godowns(id);
ALTER TABLE public.stock_inventory ADD CONSTRAINT stock_inventory_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public.stock_inventory ADD CONSTRAINT stock_inventory_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.packaging_materials(id);
ALTER TABLE public.stock_inventory ADD CONSTRAINT stock_inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.stock_ledger ADD CONSTRAINT stock_ledger_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.stock_ledger ADD CONSTRAINT stock_ledger_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public.stock_ledger ADD CONSTRAINT stock_ledger_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.godowns(id);
ALTER TABLE public.stock_ledger ADD CONSTRAINT stock_ledger_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE public.stock_transfer_items ADD CONSTRAINT stock_transfer_items_stock_transfer_id_fkey FOREIGN KEY (stock_transfer_id) REFERENCES public.stock_transfers(id);
ALTER TABLE public.stock_transfer_items ADD CONSTRAINT stock_transfer_items_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_from_godown_id_fkey FOREIGN KEY (from_godown_id) REFERENCES public.godowns(id);
ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_to_godown_id_fkey FOREIGN KEY (to_godown_id) REFERENCES public.godowns(id);
ALTER TABLE public.stock_transfers ADD CONSTRAINT stock_transfers_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.support_tickets ADD CONSTRAINT fk_ticket_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);
ALTER TABLE public.support_tickets ADD CONSTRAINT fk_ticket_order FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE public.ticket_messages ADD CONSTRAINT fk_message_ticket FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id);
ALTER TABLE public.user_agent_config ADD CONSTRAINT user_agent_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
ALTER TABLE public.users ADD CONSTRAINT users_delivery_partner_id_fkey FOREIGN KEY (delivery_partner_id) REFERENCES public.delivery_partners(id);
ALTER TABLE public.variant_material_mapping ADD CONSTRAINT variant_material_mapping_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id);
ALTER TABLE public.variant_material_mapping ADD CONSTRAINT variant_material_mapping_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.packaging_materials(id);
ALTER TABLE public.variant_material_mapping ADD CONSTRAINT variant_material_mapping_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);
ALTER TABLE public.vendor_loose_stock ADD CONSTRAINT vendor_loose_stock_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE public.vendor_loose_stock ADD CONSTRAINT vendor_loose_stock_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id);
ALTER TABLE public.vendor_stock ADD CONSTRAINT vendor_stock_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
ALTER TABLE public.vendor_stock ADD CONSTRAINT vendor_stock_stock_inventory_id_fkey FOREIGN KEY (stock_inventory_id) REFERENCES public.stock_inventory(id);
ALTER TABLE public.vendors ADD CONSTRAINT vendors_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE public.vendors ADD CONSTRAINT vendors_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES public.distributors(id);
