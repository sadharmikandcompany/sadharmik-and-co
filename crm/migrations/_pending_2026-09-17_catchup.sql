-- ============================================================
-- Catch-up batch: migrations that exist in this repo but were
-- never applied to the Sadharmik Supabase project (schema drift
-- from the Kalapurna copy). Safe to run once, top to bottom.
-- Generated 2026-09-17 after auditing the live DB column-by-column.
-- ============================================================

-- ===== add_item_description_to_order_items.sql =====
-- Optional free-text note per order line item (e.g. batch/packaging detail,
-- special instructions) shown as a small description box under the product
-- name on the order creation pages.
alter table public.order_items
  add column if not exists item_description text;

comment on column public.order_items.item_description is
  'Optional free-text note for this line item, entered on the order creation page';

-- ===== add_bank_accounts_opening_balance.sql =====
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

-- ===== add_bank_transactions_created_by.sql =====
-- bank_transactions has no owner/entity column, so non-admin-like roles
-- (Factories, Distributors, Retailers, Vendors, Delivery Drivers — anyone
-- who can reach /dashboard/accounting/reconciliation but isn't admin /
-- warehouse / customer_support) were shown an empty Transactions list
-- unconditionally, even for entries they themselves just created via
-- "Create Transaction". This lets the app scope the list to "admin-like
-- roles see everything, everyone else sees only rows they created" instead
-- of hiding the whole shared ledger from them.
--
-- The app is defensive about this column not existing yet (falls back to
-- the old admin-only-see-anything behavior on a PGRST204 "column not found"
-- error, same pattern used for shipping_charges/purchase_category), so
-- nothing breaks before this migration is run — new transactions just won't
-- be attributed to their creator, and non-admin roles won't see their own
-- entries, until it is.

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_by
  ON public.bank_transactions (created_by);

-- ===== add_payment_allocations.sql =====
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

-- ===== add_order_payment_allocations.sql =====
-- Mirror of the vendor/purchases payment-allocation fix, applied to the
-- receivable side: "Payment In" transactions recorded in Reconciliation for
-- a customer/distributor never updated the matching order's paid status —
-- orders only ever had a flat payment_status (no paid_amount/remaining
-- field at all, unlike purchases), so a payment being received and a bill
-- staying "pending"/"partial" on the Factory Dashboard's Bills Receivable
-- card were two completely disconnected facts. Confirmed live: ₹2.72cr in
-- already-received payments had a matching unpaid order to apply against.
--
-- 1. orders gets a paid_amount column (purchases already has one) plus a
--    generated remaining_amount, so partial payments are trackable
--    precisely instead of the order just flipping to a single "partial"
--    status with no number attached.
-- 2. payment_allocations (built for purchases) is generalized to also
--    reference an order — purchase_id is now nullable, order_id is added,
--    and a check constraint requires exactly one of the two, so the same
--    ledger/audit-trail table covers both payable and receivable sides
--    instead of needing a parallel copy of it.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS remaining_amount numeric
  GENERATED ALWAYS AS (total_amount - paid_amount) STORED;

ALTER TABLE public.payment_allocations
  ALTER COLUMN purchase_id DROP NOT NULL;

ALTER TABLE public.payment_allocations
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_one_target_check;

ALTER TABLE public.payment_allocations
  ADD CONSTRAINT payment_allocations_one_target_check
  CHECK ((purchase_id IS NOT NULL) <> (order_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_payment_allocations_order ON public.payment_allocations (order_id);

-- orders_v (used by the Factory Dashboard's Bills Receivable card) selects
-- o.* — but Postgres freezes a view's column list at creation time, so the
-- two new columns above won't actually appear there until the view itself
-- is recreated. Re-running the exact current definition from
-- migrations/fix_orders_view_distributor_company_name.sql (unchanged) so it
-- picks them up in the same migration, rather than requiring a second file.
DROP VIEW IF EXISTS orders_v;

CREATE VIEW orders_v AS
SELECT
  o.*,

  -- Computed customer/party name
  COALESCE(
    CASE WHEN o.customer_id IS NOT NULL
      THEN TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))
    END,
    CASE WHEN o.retailer_id IS NOT NULL
      THEN r.name || ' (Retailer)'
    END,
    CASE WHEN o.distributor_id IS NOT NULL
      THEN COALESCE(d.company_name, d.name) || CASE WHEN o.is_subdistributor = true THEN ' (Subdistributor)' ELSE ' (Distributor)' END
    END,
    'Unknown'
  ) AS customer_name,

  -- Customer contact info
  COALESCE(c.mobile_primary, r.phone_primary, d.phone_primary) AS customer_phone,
  c.mobile_secondary_1 AS customer_phone_secondary_1,
  c.mobile_secondary_2 AS customer_phone_secondary_2,
  CASE WHEN c.whatsapp_same_as_primary = true THEN NULL ELSE c.whatsapp_number END AS customer_whatsapp,
  COALESCE(c.full_address, r.company_name, d.company_name) AS customer_full_address,
  c.vip_number AS customer_vip_number,
  c.email AS customer_email,
  c.company_name AS customer_company_name,

  -- Delivery partner info
  dp.name AS delivery_partner_name,
  dp.mobile AS delivery_partner_mobile,

  -- Route assignment info (latest per order)
  ra.status AS route_assignment_status,
  ra.pickup_time,
  ra.delivery_time,
  ra.delivery_notes,
  ra.collected_payment_method,
  ra.collected_amount,
  ra.customer_rating,
  ra.customer_feedback,

  -- Route name
  rt.route_name,

  -- Serviceable distributor (matched by shipping pincode)
  svc.svc_distributor_id AS serviceable_distributor_id,
  svc.svc_distributor_name AS serviceable_distributor_name

FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN distributors d ON o.distributor_id = d.id
LEFT JOIN retailers r ON o.retailer_id = r.id
LEFT JOIN delivery_partners dp ON o.delivery_partner_id = dp.id
LEFT JOIN LATERAL (
  SELECT
    ra2.status, ra2.pickup_time, ra2.delivery_time, ra2.delivery_notes,
    ra2.collected_payment_method, ra2.collected_amount,
    ra2.customer_rating, ra2.customer_feedback, ra2.route_id
  FROM route_assignments ra2
  WHERE ra2.order_id = o.id
  LIMIT 1
) ra ON true
LEFT JOIN routes rt ON rt.id = ra.route_id
LEFT JOIN LATERAL (
  SELECT sd.id AS svc_distributor_id, sd.name AS svc_distributor_name
  FROM distributors sd
  WHERE sd.serviceable_pincodes IS NOT NULL
    AND o.shipping_pincode IS NOT NULL
    AND o.shipping_pincode = ANY(sd.serviceable_pincodes)
  LIMIT 1
) svc ON true;

-- ===== add_itc_eligibility_to_purchases.sql =====
-- Input Tax Credit (ITC) eligibility flags for GST payable calculation.
-- Milk purchases are GST-exempt (0%) and must never generate ITC; packaging,
-- transport, and other taxed inputs are ITC-eligible by default.

-- Per-item flag: does this specific line item's GST count toward ITC?
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS is_itc_eligible boolean NOT NULL DEFAULT true;

-- Per-purchase override: mark a whole purchase (e.g. a pure milk purchase) as
-- exempt in one click instead of toggling every line item individually.
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS is_itc_eligible boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_purchase_items_itc_eligible
  ON public.purchase_items (is_itc_eligible);

-- ===== add_loose_stock_transaction_gst.sql =====
-- Loose (litre-based) purchases had no way to record GST at all, so they
-- never contributed to Input Tax Credit even when the vendor genuinely
-- charges GST (e.g. 5% on ghee). Mirrors the GST columns already on
-- purchase_items.
ALTER TABLE public.loose_stock_transactions
  ADD COLUMN IF NOT EXISTS gst_percentage numeric,
  ADD COLUMN IF NOT EXISTS gst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_itc_eligible boolean NOT NULL DEFAULT true;

-- ===== add_note_shipping_charges.sql =====
-- Adds a Shipping Charges field to debit notes and credit notes, mirroring
-- purchases.shipping_charges (an amount added on top of the item total,
-- not itself taxed/discounted like a line item — e.g. courier/freight
-- charged separately on the original bill/invoice being adjusted).
--
-- The app is defensive about this column not existing yet (it retries the
-- save without shipping_charges on a PGRST204 "column not found" error, the
-- same pattern used for purchase_category), so nothing breaks before this
-- migration is run — but the field won't actually persist until it is.

ALTER TABLE public.debit_notes
  ADD COLUMN IF NOT EXISTS shipping_charges numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS shipping_charges numeric(12, 2) NOT NULL DEFAULT 0;

-- ===== add_purchase_category.sql =====
-- Classifies a purchase as a material (stock) purchase vs a non-material
-- purchase that should be treated as a direct/indirect expense in P&L —
-- matching how Tally shows a GST bill in Total Purchase but bifurcates it
-- into Purchase/Expense on the P&L statement.
--
-- Replaces the old "Create Expense Record" behavior on the purchase form,
-- which mirrored the purchase into a SEPARATE expenses row — double-counting
-- the amount (once in Total Purchase, again as an expense). Purchases are
-- now classified in place instead; no second record is created.

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS purchase_category text NOT NULL DEFAULT 'material';

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_category_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_category_check
  CHECK (purchase_category = ANY (ARRAY['material'::text, 'direct_expense'::text, 'indirect_expense'::text]));

COMMENT ON COLUMN public.purchases.purchase_category IS
  'material = raw material/stock purchase (counts toward Total Purchase/COGS in P&L). direct_expense/indirect_expense = non-material GST purchase (e.g. office supplies, services) that should be excluded from Total Purchase and shown as an expense in P&L instead.';

-- ===== add_purchase_category_fixed_asset_other.sql =====
-- Adds two more purchase_category values on top of the original
-- material / direct_expense / indirect_expense set (see add_purchase_category.sql):
--
--   fixed_asset — machinery, vehicles, equipment, etc. Capitalized on the
--     Balance Sheet, NOT expensed — deliberately excluded from every P&L
--     bucket (it isn't material/COGS and isn't a direct/indirect expense).
--   other       — catch-all for a non-material purchase that doesn't clearly
--     fit direct or indirect expense. Treated as an indirect expense in P&L
--     so the amount is still accounted for somewhere, not silently dropped.

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_category_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_category_check
  CHECK (purchase_category = ANY (ARRAY[
    'material'::text,
    'direct_expense'::text,
    'indirect_expense'::text,
    'fixed_asset'::text,
    'other'::text
  ]));

COMMENT ON COLUMN public.purchases.purchase_category IS
  'material = raw material/stock purchase (counts toward Total Purchase/COGS in P&L). direct_expense/indirect_expense = non-material GST purchase (e.g. office supplies, services) shown as an expense in P&L instead of Total Purchase. fixed_asset = capitalized asset (machinery/vehicles/equipment), excluded from P&L entirely. other = non-material purchase that does not clearly fit direct/indirect expense, booked as an indirect expense so it is still accounted for.';

-- ===== add_purchase_category_mixed.sql =====
-- Adds a "mixed" purchase_category value: for an invoice with no single
-- sensible default category (e.g. a voucher with a Direct Expense line AND
-- an Indirect Expense line, per add_purchase_item_category.sql), forcing the
-- user to pick an arbitrary "primary" category at the purchase level was
-- misleading — worse, it silently broke reporting, since the P&L/Expenses
-- page only look at line-item overrides when the purchase's OWN category
-- isn't "material" and, in the Expenses page, only when it's in the
-- direct_expense/indirect_expense/other allow-list.
--
-- "mixed" means: every line item on this purchase MUST have its own explicit
-- purchase_category (enforced client-side on save) — there is no
-- purchase-level default to fall back to.

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_purchase_category_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_purchase_category_check
  CHECK (purchase_category = ANY (ARRAY[
    'material'::text,
    'direct_expense'::text,
    'indirect_expense'::text,
    'fixed_asset'::text,
    'other'::text,
    'mixed'::text
  ]));

COMMENT ON COLUMN public.purchases.purchase_category IS
  'material = raw material/stock purchase (counts toward Total Purchase/COGS in P&L). direct_expense/indirect_expense = non-material GST purchase shown as an expense in P&L instead of Total Purchase. fixed_asset = capitalized asset, excluded from P&L entirely. other = non-material purchase that does not clearly fit direct/indirect expense, booked as an indirect expense. mixed = no single category applies to the whole invoice — every purchase_items row on it must carry its own purchase_category override instead.';

-- ===== add_purchase_item_batch_number.sql =====
-- A single purchase invoice can bundle items from two different manufacturing
-- batches (e.g. two batches of ghee on one vendor bill). The purchases table
-- already has one purchase-level batch_number, which can't represent that —
-- so batch tracking needs to move to the line-item level.
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS batch_number text;

-- ===== add_purchase_item_category.sql =====
-- Lets a single purchase/invoice mix categories across its line items — e.g.
-- a Tally voucher with a "RO Material Purchase" line (Direct Expense) and a
-- "Transportation" line (Indirect Expense) in the SAME voucher. Previously
-- purchase_category only existed on the purchases row (see
-- add_purchase_category.sql / add_purchase_category_fixed_asset_other.sql),
-- forcing one category for the whole invoice.
--
-- NULL means "inherit the parent purchase's purchase_category" — most
-- purchases are single-category, so this stays unset for them; it's only
-- populated when a line item is deliberately overridden to a different
-- category than the rest of the purchase.

ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS purchase_category text;

ALTER TABLE public.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_purchase_category_check;
ALTER TABLE public.purchase_items ADD CONSTRAINT purchase_items_purchase_category_check
  CHECK (purchase_category IS NULL OR purchase_category = ANY (ARRAY[
    'material'::text,
    'direct_expense'::text,
    'indirect_expense'::text,
    'fixed_asset'::text,
    'other'::text
  ]));

COMMENT ON COLUMN public.purchase_items.purchase_category IS
  'Per-line override of the parent purchase''s purchase_category, for invoices that mix categories across line items (e.g. a material line and a transportation-expense line on the same voucher). NULL = inherit the parent purchases.purchase_category.';

-- ===== add_purchase_round_off.sql =====
-- Purchases had no column to store a manual rounding adjustment; "Other Tax"
-- and "Other Charges" are being removed from the purchase form in favor of a
-- single editable Round Off amount (can be positive or negative, unlike
-- other_charges/tax_amount which are constrained to >= 0).
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS round_off numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.purchases.round_off IS
  'Manual rounding adjustment applied to total_amount; positive or negative.';

-- ===== allow_distributor_retailer_party_type.sql =====
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

-- ===== create_tally_product_mappings.sql =====
-- Remembers which catalog product a given Tally invoice line description
-- refers to, so the "Order from Factory" Tally-PDF auto-fill can resolve
-- items exactly instead of re-guessing every time (Tally's short codes like
-- "08 COW GHEE 15 LTR BUK" are ambiguous against multiple catalog SKUs that
-- share the same type + size, e.g. Bottle vs Tin vs Bottle Mandir).
create table if not exists public.tally_product_mappings (
  id uuid primary key default gen_random_uuid(),
  tally_description text not null unique, -- normalized: trimmed, collapsed whitespace, uppercased
  product_id uuid not null references public.products(id) on delete cascade,
  hsn_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tally_product_mappings_product_id
  on public.tally_product_mappings(product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tally_product_mappings_updated_at on public.tally_product_mappings;
create trigger trg_tally_product_mappings_updated_at
before update on public.tally_product_mappings
for each row execute function public.set_updated_at();

comment on table public.tally_product_mappings is
  'Learned mapping from a Tally sales-invoice line description to the catalog product it refers to, used by the Order from Factory Tally-PDF auto-fill feature';
comment on column public.tally_product_mappings.tally_description is
  'Normalized (trim + collapse whitespace + uppercase) Tally item description, used as the lookup key';

alter table public.tally_product_mappings disable row level security;

-- ===== add_purchase_tally_mappings.sql =====
-- Remembers which CRM stock item or catalog product a given vendor's Tally
-- purchase-bill line description resolves to, once a human confirms it once
-- (mirrors tally_product_mappings, used for the Order-from-Factory sales
-- side). Scoped per-vendor since the same raw description could plausibly
-- mean different things for different vendors.
CREATE TABLE IF NOT EXISTS public.purchase_tally_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  tally_description text NOT NULL,
  stock_inventory_id uuid REFERENCES public.stock_inventory(id),
  product_id uuid REFERENCES public.products(id),
  is_loose_stock boolean NOT NULL DEFAULT false,
  loose_stock_category_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT purchase_tally_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_tally_mappings_vendor_desc_key UNIQUE (vendor_id, tally_description),
  CONSTRAINT purchase_tally_mappings_one_target CHECK (
    (stock_inventory_id IS NOT NULL)::int + (product_id IS NOT NULL)::int + (is_loose_stock)::int = 1
  )
);

ALTER TABLE public.purchase_tally_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage purchase tally mappings"
  ON public.purchase_tally_mappings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

