-- ============================================================
-- Migration: credit/debit notes must affect stock
-- Date: 2026-07-04
-- Why (factory request):
--   Credit notes (goods returned to us) were not adding stock back,
--   and debit notes (goods returned to vendors) were not subtracting
--   stock. Note items now carry product_id (UI change shipped
--   alongside this migration), and these triggers apply the movement.
-- Run in the Supabase SQL editor (project jneclnidpacecswqgfyj).
-- ============================================================

-- 1) Link note items to catalog products
ALTER TABLE credit_note_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);
ALTER TABLE debit_note_items  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id);

-- 2) Credit note item (sales return, goods come back in) → stock increases
CREATE OR REPLACE FUNCTION apply_credit_note_stock()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.product_id IS NOT NULL THEN
    UPDATE products
    SET stock = COALESCE(stock, 0) + COALESCE(NEW.quantity, 0),
        updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.product_id IS NOT NULL THEN
    -- Removing a note item reverses its stock movement
    UPDATE products
    SET stock = COALESCE(stock, 0) - COALESCE(OLD.quantity, 0),
        updated_at = NOW()
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_credit_note_stock ON credit_note_items;
CREATE TRIGGER trigger_credit_note_stock
  AFTER INSERT OR DELETE ON credit_note_items
  FOR EACH ROW EXECUTE FUNCTION apply_credit_note_stock();

-- 3) Debit note item (purchase return, goods go back out) → stock decreases
CREATE OR REPLACE FUNCTION apply_debit_note_stock()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.product_id IS NOT NULL THEN
    UPDATE products
    SET stock = COALESCE(stock, 0) - COALESCE(NEW.quantity, 0),
        updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.product_id IS NOT NULL THEN
    UPDATE products
    SET stock = COALESCE(stock, 0) + COALESCE(OLD.quantity, 0),
        updated_at = NOW()
    WHERE id = OLD.product_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_debit_note_stock ON debit_note_items;
CREATE TRIGGER trigger_debit_note_stock
  AFTER INSERT OR DELETE ON debit_note_items
  FOR EACH ROW EXECUTE FUNCTION apply_debit_note_stock();
