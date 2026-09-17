-- These two functions exist in production but were never captured in the
-- sandbox (Postgres functions aren't part of a table/column schema dump).
-- Pulled verbatim from production via a read-only Management API query so
-- the sandbox's "Convert to Invoice" flow (which calls get_next_invoice_number)
-- behaves identically. Safe to re-run.

CREATE OR REPLACE FUNCTION public.get_or_create_distributor_invoice_seq(dist_code text, is_gst boolean)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  seq_name TEXT;
  next_num INTEGER;
BEGIN
  -- Create sequence name based on distributor code and invoice type
  IF is_gst THEN
    seq_name := 'invoice_' || lower(dist_code) || '_gst_seq';
  ELSE
    seq_name := 'invoice_' || lower(dist_code) || '_non_gst_seq';
  END IF;

  -- Check if sequence exists, create if not
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = seq_name AND relkind = 'S'
  ) THEN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  END IF;

  -- Get next value from sequence
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_num;

  RETURN next_num;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_next_invoice_number(is_gst boolean, dist_code text DEFAULT NULL::text, force_kp boolean DEFAULT false, p_is_mandir boolean DEFAULT false, p_is_shop boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
  DECLARE
    next_num INTEGER;
    invoice_num TEXT;
    max_existing INTEGER;
    max_attempts INTEGER := 100;
    attempt INTEGER := 0;
    fy_suffix TEXT;
    fy_start_year INTEGER;
    prefix TEXT;
  BEGIN
    IF dist_code = '' THEN
      dist_code := NULL;
    END IF;

    -- Calculate financial year suffix (April to March)
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 4 THEN
      fy_start_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
    ELSE
      fy_start_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER - 1;
    END IF;
    fy_suffix := '/' || fy_start_year || '-' || RIGHT((fy_start_year + 1)::TEXT, 2);

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

    -- GST invoice without distributor code (KP prefix with FY suffix, resets each FY)
    -- NOTE: sequence is shared across BOTH invoice_number_gst and invoice_number_non_gst
    -- so a single KP{n}/{FY} string never appears twice across the two columns.
    ELSIF is_gst THEN
      SELECT MAX(num) INTO max_existing FROM (
        SELECT CAST(REGEXP_REPLACE(SUBSTRING(invoice_number_gst FROM 3), '/.*$', '') AS INTEGER) AS num
        FROM orders
        WHERE invoice_number_gst LIKE 'KP%' || fy_suffix
        UNION ALL
        SELECT CAST(REGEXP_REPLACE(SUBSTRING(invoice_number_non_gst FROM 3), '/.*$', '') AS INTEGER) AS num
        FROM orders
        WHERE invoice_number_non_gst LIKE 'KP%' || fy_suffix
      ) AS combined;

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := 1;
      END IF;

      LOOP
        invoice_num := 'KP' || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0') || fy_suffix;
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM orders
          WHERE invoice_number_gst = invoice_num
             OR invoice_number_non_gst = invoice_num
        );
        next_num := next_num + 1;
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique GST invoice number after % attempts', max_attempts;
        END IF;
      END LOOP;

    -- Non-GST invoice without distributor code, force_kp = TRUE
    -- Used by factory customer orders (is_factory_order = TRUE).
    -- Shares the KP{n}/{FY} sequence with the GST KP branch above so the
    -- printed invoice string is unique across BOTH columns.
    ELSIF force_kp THEN
      SELECT MAX(num) INTO max_existing FROM (
        SELECT CAST(REGEXP_REPLACE(SUBSTRING(invoice_number_gst FROM 3), '/.*$', '') AS INTEGER) AS num
        FROM orders
        WHERE invoice_number_gst LIKE 'KP%' || fy_suffix
        UNION ALL
        SELECT CAST(REGEXP_REPLACE(SUBSTRING(invoice_number_non_gst FROM 3), '/.*$', '') AS INTEGER) AS num
        FROM orders
        WHERE invoice_number_non_gst LIKE 'KP%' || fy_suffix
      ) AS combined;

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := 1;
      END IF;

      LOOP
        invoice_num := 'KP' || LPAD(next_num::TEXT, GREATEST(3, LENGTH(next_num::TEXT)), '0') || fy_suffix;
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM orders
          WHERE invoice_number_gst = invoice_num
             OR invoice_number_non_gst = invoice_num
        );
        next_num := next_num + 1;
        attempt := attempt + 1;
        IF attempt >= max_attempts THEN
          RAISE EXCEPTION 'Could not generate unique non-GST KP invoice number after % attempts', max_attempts;
        END IF;
      END LOOP;

    -- Non-GST invoice without distributor code (default): a single "A"
    -- sequence for every order regardless of customer tier — bill numbers
    -- must stay one continuous series (A1, A2, A3...), not branch by
    -- whether the customer happens to be Sd/Mandir/Shop. p_is_mandir and
    -- p_is_shop are accepted but intentionally unused here, kept only so
    -- existing callers don't need to change what they pass.
    ELSE
      prefix := 'A';

      SELECT MAX(CAST(SUBSTRING(invoice_number_non_gst FROM LENGTH(prefix) + 1) AS INTEGER))
      INTO max_existing
      FROM orders
      WHERE invoice_number_non_gst ~ ('^' || prefix || '[0-9]+$');

      IF max_existing IS NOT NULL THEN
        next_num := max_existing + 1;
      ELSE
        next_num := 1;
      END IF;

      LOOP
        invoice_num := prefix || next_num::TEXT;
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
