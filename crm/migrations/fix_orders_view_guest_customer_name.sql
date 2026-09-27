-- Website checkout orders (source = 'website') are guest orders: no
-- customer_id, just customer_first_name/last_name/full_name saved directly
-- on the order (see app/api/public-orders/route.ts). orders_v's
-- customer_name never checked those columns, so every guest order showed
-- as "Unknown" everywhere (Orders list, Factory Dashboard AR breakdown,
-- etc.) even though the real name was sitting right there in the row —
-- purely a display bug, did not affect any totals.
--
-- The guest's phone number has the same problem, but worse: there was never
-- even a column for it — public-orders/route.ts only ever wrote it into
-- order_notes as free text ("Placed via website. Phone: 9022586904"), so it
-- was never queryable at all, not just hidden by a missing view fallback.
-- Adds a real guest_phone column, backfills it for existing website orders
-- by extracting the digits after "Phone:" in order_notes, and wires it into
-- customer_phone's fallback chain. app/api/public-orders/route.ts is
-- updated separately to write this column directly going forward instead
-- of only embedding it in the notes text.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS guest_phone text;

UPDATE public.orders
SET guest_phone = (regexp_match(order_notes, 'Phone:\s*(\d+)'))[1]
WHERE guest_phone IS NULL
  AND order_notes ~ 'Phone:\s*\d+';

-- Full DROP + CREATE (not CREATE OR REPLACE): orders has grown new trailing
-- columns since this view was last created (see
-- add_distributor_mandir_opt_out_to_view.sql's note on this), which shifts
-- what o.* expands to and breaks CREATE OR REPLACE's column-position check.
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
    NULLIF(TRIM(COALESCE(o.customer_full_name, TRIM(COALESCE(o.customer_first_name, '') || ' ' || COALESCE(o.customer_last_name, '')))), ''),
    'Unknown'
  ) AS customer_name,

  -- Customer contact info
  COALESCE(c.mobile_primary, r.phone_primary, d.phone_primary, o.guest_phone) AS customer_phone,
  c.mobile_secondary_1 AS customer_phone_secondary_1,
  c.mobile_secondary_2 AS customer_phone_secondary_2,
  CASE WHEN c.whatsapp_same_as_primary = true THEN NULL ELSE c.whatsapp_number END AS customer_whatsapp,
  COALESCE(c.full_address, r.company_name, d.company_name) AS customer_full_address,
  c.is_vip AS customer_is_vip,
  c.vip_number AS customer_vip_number,
  c.is_mandir AS customer_is_mandir,
  c.mandir_number AS customer_mandir_number,
  c.is_shop AS customer_is_shop,
  c.shop_number AS customer_shop_number,
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

  -- Serviceable distributor (matched by shipping pincode, excluding a
  -- distributor who has opted out of Mandir customers when this order's
  -- customer is Mandir-tagged)
  svc.svc_distributor_id AS serviceable_distributor_id,
  svc.svc_distributor_name AS serviceable_distributor_name,

  -- Actual distributor this order belongs to (o.distributor_id), distinct
  -- from the pincode-based serviceable_distributor_name above.
  COALESCE(d.company_name, d.name) AS order_distributor_name

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
    AND (c.is_mandir IS NOT TRUE OR sd.serves_mandir_customers = true)
  LIMIT 1
) svc ON true;
