-- The orders_v view's computed customer_name used the distributor's personal
-- name (d.name, e.g. "Bhavya Gandhi") for distributor orders instead of their
-- registered business name — shows up as "Bhavya Gandhi (Distributor)" in
-- Orders v2 when it should read "SADHARMIK & COMPANY (Distributor)". Falls back to
-- the person's name if the distributor has no company_name on file.
-- Re-running the full view definition from migrations/create_orders_view_for_ssr.sql
-- with only that one CASE branch changed.
--
-- Using DROP + CREATE rather than CREATE OR REPLACE: the underlying `orders`
-- table has gained columns since this view was first created, so `o.*` now
-- expands to a different column list/order than the view's existing
-- definition expects — CREATE OR REPLACE VIEW rejects that (it only allows
-- appending columns at the end, never reordering/renaming existing ones).

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
