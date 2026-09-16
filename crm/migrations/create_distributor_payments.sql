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
