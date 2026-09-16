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
