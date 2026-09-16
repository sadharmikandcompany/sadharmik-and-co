-- ============================================================
-- Migration: Non-GST Invoice Prefix A for FY 2026-27
-- Date: 2026-04-01
-- Description:
--   1. Renumber today's 41 non-GST invoices (5652-5692) to A1-A41
--   2. Update get_next_invoice_number() to generate A-prefixed
--      non-GST invoice numbers going forward
-- ============================================================

-- ============================================================
-- STEP 1: Renumber today's existing non-GST invoices
-- Maps: 5652 -> A1, 5653 -> A2, ... 5692 -> A41
-- ============================================================
WITH numbered AS (
  SELECT id, invoice_number_non_gst,
    ROW_NUMBER() OVER (ORDER BY CAST(invoice_number_non_gst AS INTEGER) ASC) as rn
  FROM orders
  WHERE invoice_number_non_gst IS NOT NULL
    AND invoice_number_non_gst ~ '^[0-9]+$'
    AND order_date >= '2026-04-01'
)
UPDATE orders o
SET invoice_number_non_gst = 'A' || n.rn
FROM numbered n
WHERE o.id = n.id;


-- ============================================================
-- STEP 2: Update get_next_invoice_number function
-- ONLY the last ELSE block changes (non-GST without distributor code)
-- Old: plain numbers (5693, 5694...)
-- New: A-prefixed (A42, A43...)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_next_invoice_number(is_gst boolean, dist_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
  DECLARE
    next_num INTEGER;
    invoice_num TEXT;
    max_existing INTEGER;
    max_attempts INTEGER := 100;
    attempt INTEGER := 0;
  BEGIN
    IF dist_code = '' THEN
      dist_code := NULL;
    END IF;

    -- GST invoice with distributor code
    IF is_gst AND dist_code IS NOT NULL THEN
      SELECT MAX(CAST(SUBSTRING(invoice_number_gst FROM LENGTH(dist_code) + 1) AS INTEGER))
      INTO max_existing
      FROM orders
      WHERE invoice_number_gst LIKE dist_code || '%';

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := get_or_create_distributor_invoice_seq(dist_code, TRUE);
      END IF;

      LOOP
        invoice_num := dist_code || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE invoice_number_gst = invoice_num);
        next_num := next_num + 1;
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique GST invoice number after % attempts', max_attempts;
        END IF;
      END LOOP;

    -- Non-GST invoice with distributor code
    ELSIF NOT is_gst AND dist_code IS NOT NULL THEN
      SELECT MAX(CAST(SUBSTRING(invoice_number_non_gst FROM LENGTH(dist_code) + 1) AS INTEGER))
      INTO max_existing
      FROM orders
      WHERE invoice_number_non_gst LIKE dist_code || '%';

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := get_or_create_distributor_invoice_seq(dist_code, FALSE);
      END IF;

      LOOP
        invoice_num := dist_code || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE invoice_number_non_gst = invoice_num);
        next_num := next_num + 1;
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique non-GST invoice number after % attempts', max_attempts;
        END IF;
      END LOOP;

    -- GST invoice without distributor code (KP prefix - unchanged)
    ELSIF is_gst THEN
      SELECT MAX(CAST(SUBSTRING(invoice_number_gst FROM 3) AS INTEGER))
      INTO max_existing
      FROM orders
      WHERE invoice_number_gst LIKE 'KP%';

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := nextval('invoice_gst_seq');
      END IF;

      LOOP
        invoice_num := 'KP' || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE invoice_number_gst = invoice_num);
        next_num := next_num + 1;
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique GST invoice number after % attempts', max_attempts;
        END IF;
      END LOOP;

    -- *** CHANGED FOR FY 2026-27 ***
    -- Non-GST invoice without distributor code: A prefix
    -- Old: plain numbers (5693, 5694...)
    -- New: A1, A2, A3... (resets from 1 with A prefix)
    ELSE
      SELECT MAX(CAST(SUBSTRING(invoice_number_non_gst FROM 2) AS INTEGER))
      INTO max_existing
      FROM orders
      WHERE invoice_number_non_gst ~ '^A[0-9]+$';

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := 1;
      END IF;

      LOOP
        invoice_num := 'A' || next_num::TEXT;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM orders WHERE invoice_number_non_gst = invoice_num);
        next_num := next_num + 1;
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique non-GST invoice number after % attempts', max_attempts;
        END IF;
      END LOOP;
    END IF;

    RETURN invoice_num;
  END;
  $function$;
