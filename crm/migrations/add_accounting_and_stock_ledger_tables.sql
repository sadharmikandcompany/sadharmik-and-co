-- Migration: Add Accounting Foundation & Stock Ledger Tables
-- Date: 2026-03-21
-- Description: Creates tables for Chart of Accounts, Journal Entries, Tax Ledger,
--              Stock Ledger, Stock Batches, GRN, AP Invoices, Bank Reconciliation,
--              Reorder Rules, and Accounting Periods.

-- ============================================================
-- 1. Chart of Accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
  parent_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT false,
  gst_category VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_coa_type ON chart_of_accounts(type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_id);

-- ============================================================
-- 2. Accounting Periods
-- ============================================================
CREATE TABLE IF NOT EXISTS accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_name VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  closed_by UUID REFERENCES users(id),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Journal Entries
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number VARCHAR(50) UNIQUE,
  entry_date DATE NOT NULL,
  narration TEXT,
  reference_type VARCHAR(50),
  reference_id UUID,
  status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Posted', 'Reversed')),
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id),
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  period_id UUID REFERENCES accounting_periods(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_je_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_reference ON journal_entries(reference_type, reference_id);

-- ============================================================
-- 4. Journal Lines
-- ============================================================
CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  narration TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jl_journal ON journal_lines(journal_id);
CREATE INDEX idx_jl_account ON journal_lines(account_id);

-- ============================================================
-- 5. Tax Ledger
-- ============================================================
CREATE TABLE IF NOT EXISTS tax_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date DATE NOT NULL,
  txn_type VARCHAR(50) NOT NULL,
  reference_type VARCHAR(50),
  reference_id UUID,
  party_name VARCHAR(255),
  gstin VARCHAR(15),
  hsn VARCHAR(20),
  taxable_value NUMERIC(15,2) DEFAULT 0,
  cgst_rate NUMERIC(5,2) DEFAULT 0,
  cgst_amount NUMERIC(15,2) DEFAULT 0,
  sgst_rate NUMERIC(5,2) DEFAULT 0,
  sgst_amount NUMERIC(15,2) DEFAULT 0,
  igst_rate NUMERIC(5,2) DEFAULT 0,
  igst_amount NUMERIC(15,2) DEFAULT 0,
  cess_amount NUMERIC(15,2) DEFAULT 0,
  total_tax NUMERIC(15,2) DEFAULT 0,
  invoice_number VARCHAR(100),
  is_b2b BOOLEAN DEFAULT false,
  state_code VARCHAR(5),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tl_txn_date ON tax_ledger(txn_date);
CREATE INDEX idx_tl_txn_type ON tax_ledger(txn_type);
CREATE INDEX idx_tl_reference ON tax_ledger(reference_type, reference_id);
CREATE INDEX idx_tl_hsn ON tax_ledger(hsn);

-- ============================================================
-- 6. Stock Ledger (Immutable Movement Log)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  warehouse_id UUID REFERENCES godowns(id),
  txn_type VARCHAR(50) NOT NULL CHECK (txn_type IN (
    'PURCHASE_RECEIPT', 'SALE_ISSUE', 'TRANSFER_IN', 'TRANSFER_OUT',
    'ADJUSTMENT', 'WRITE_OFF', 'OPENING_BALANCE', 'RETURN_IN', 'RETURN_OUT',
    'PRODUCTION_IN', 'PRODUCTION_OUT'
  )),
  qty NUMERIC(15,3) NOT NULL,
  rate NUMERIC(15,2) DEFAULT 0,
  amount NUMERIC(15,2) DEFAULT 0,
  reference_type VARCHAR(50),
  reference_id UUID,
  balance_qty NUMERIC(15,3) DEFAULT 0,
  balance_value NUMERIC(15,2) DEFAULT 0,
  batch_id UUID,
  narration TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sl_product ON stock_ledger(product_id);
CREATE INDEX idx_sl_warehouse ON stock_ledger(warehouse_id);
CREATE INDEX idx_sl_txn_type ON stock_ledger(txn_type);
CREATE INDEX idx_sl_created_at ON stock_ledger(created_at);
CREATE INDEX idx_sl_reference ON stock_ledger(reference_type, reference_id);

-- ============================================================
-- 7. Stock Batches
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  warehouse_id UUID REFERENCES godowns(id),
  batch_no VARCHAR(100) NOT NULL,
  mfg_date DATE,
  expiry_date DATE CHECK (expiry_date IS NULL OR mfg_date IS NULL OR expiry_date >= mfg_date),
  qty NUMERIC(15,3) DEFAULT 0,
  rate NUMERIC(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'consumed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sb_product ON stock_batches(product_id);
CREATE INDEX idx_sb_warehouse ON stock_batches(warehouse_id);
CREATE INDEX idx_sb_expiry ON stock_batches(expiry_date);

-- ============================================================
-- 8. Goods Receipt Notes
-- ============================================================
CREATE TABLE IF NOT EXISTS goods_receipt_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number VARCHAR(50) UNIQUE,
  purchase_id UUID REFERENCES purchases(id),
  vendor_id UUID,
  vendor_name VARCHAR(255),
  received_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'qc_hold', 'approved', 'rejected')),
  discrepancy_notes TEXT,
  remarks TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_grn_purchase ON goods_receipt_notes(purchase_id);
CREATE INDEX idx_grn_status ON goods_receipt_notes(status);

-- ============================================================
-- 9. GRN Items
-- ============================================================
CREATE TABLE IF NOT EXISTS grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  expected_qty NUMERIC(15,3) DEFAULT 0,
  received_qty NUMERIC(15,3) DEFAULT 0,
  accepted_qty NUMERIC(15,3) DEFAULT 0,
  rejected_qty NUMERIC(15,3) DEFAULT 0,
  rate NUMERIC(15,2) DEFAULT 0,
  batch_id UUID REFERENCES stock_batches(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_grn_items_grn ON grn_items(grn_id);

-- ============================================================
-- 10. AP Invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS ap_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(100) NOT NULL,
  grn_id UUID REFERENCES goods_receipt_notes(id),
  vendor_id UUID,
  vendor_name VARCHAR(255),
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'partially_paid', 'cancelled')),
  payment_ref VARCHAR(255),
  journal_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_vendor ON ap_invoices(vendor_id);
CREATE INDEX idx_api_status ON ap_invoices(status);
CREATE INDEX idx_api_due_date ON ap_invoices(due_date);

-- ============================================================
-- 11. Bank Accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name VARCHAR(255) NOT NULL,
  account_no VARCHAR(50) NOT NULL,
  ifsc VARCHAR(20),
  branch VARCHAR(255),
  account_type VARCHAR(50) DEFAULT 'current',
  current_balance NUMERIC(15,2) DEFAULT 0,
  last_reconciled_date DATE,
  coa_account_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 12. Bank Transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL,
  value_date DATE,
  amount NUMERIC(15,2) NOT NULL,
  txn_type VARCHAR(10) NOT NULL CHECK (txn_type IN ('Dr', 'Cr')),
  description TEXT,
  reference VARCHAR(255),
  matched_journal_id UUID REFERENCES journal_entries(id),
  status VARCHAR(20) DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
  imported_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bt_bank ON bank_transactions(bank_account_id);
CREATE INDEX idx_bt_status ON bank_transactions(status);
CREATE INDEX idx_bt_txn_date ON bank_transactions(txn_date);

-- ============================================================
-- 13. Reorder Rules
-- ============================================================
CREATE TABLE IF NOT EXISTS reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  warehouse_id UUID REFERENCES godowns(id),
  reorder_point NUMERIC(15,3) NOT NULL DEFAULT 0,
  reorder_qty NUMERIC(15,3) NOT NULL DEFAULT 0,
  preferred_vendor_id UUID,
  auto_po BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, variant_id, warehouse_id)
);

CREATE INDEX idx_rr_product ON reorder_rules(product_id);
CREATE INDEX idx_rr_warehouse ON reorder_rules(warehouse_id);

-- ============================================================
-- Additional indexes on foreign keys for query performance
-- ============================================================
CREATE INDEX idx_sl_variant ON stock_ledger(variant_id);
CREATE INDEX idx_sb_variant ON stock_batches(variant_id);
CREATE INDEX idx_grn_items_product ON grn_items(product_id);
CREATE INDEX idx_grn_items_variant ON grn_items(variant_id);
CREATE INDEX idx_api_grn ON ap_invoices(grn_id);
CREATE INDEX idx_api_journal ON ap_invoices(journal_id);
CREATE INDEX idx_bt_matched_journal ON bank_transactions(matched_journal_id);
CREATE INDEX idx_coa_is_active ON chart_of_accounts(is_active);

-- ============================================================
-- Seed Default Chart of Accounts
-- ============================================================
INSERT INTO chart_of_accounts (code, name, type, is_system, gst_category, description) VALUES
  ('1000', 'Cash & Bank', 'Asset', true, NULL, 'Cash in hand and bank balances'),
  ('1100', 'Accounts Receivable', 'Asset', true, NULL, 'Amounts owed by customers'),
  ('1200', 'Inventory / Stock', 'Asset', true, 'Input credit tracking', 'Stock of goods held for sale'),
  ('1210', 'Goods In Transit', 'Asset', true, NULL, 'Stock dispatched but not yet received'),
  ('1300', 'Input Tax Credit - CGST', 'Asset', true, 'ITC CGST', 'CGST paid on purchases eligible for input credit'),
  ('1301', 'Input Tax Credit - SGST', 'Asset', true, 'ITC SGST', 'SGST paid on purchases eligible for input credit'),
  ('1302', 'Input Tax Credit - IGST', 'Asset', true, 'ITC IGST', 'IGST paid on purchases eligible for input credit'),
  ('2000', 'Accounts Payable', 'Liability', true, NULL, 'Amounts owed to vendors'),
  ('2100', 'Output GST Payable - CGST', 'Liability', true, 'Output CGST', 'CGST collected on sales to be remitted'),
  ('2101', 'Output GST Payable - SGST', 'Liability', true, 'Output SGST', 'SGST collected on sales to be remitted'),
  ('2102', 'Output GST Payable - IGST', 'Liability', true, 'Output IGST', 'IGST collected on sales to be remitted'),
  ('2200', 'TDS Payable', 'Liability', true, NULL, 'Tax deducted at source pending remittance'),
  ('3000', 'Owner''s Equity / Capital', 'Equity', true, NULL, 'Capital invested by the owner'),
  ('3100', 'Retained Earnings', 'Equity', true, NULL, 'Accumulated profits retained in business'),
  ('4000', 'Revenue from Sales', 'Revenue', true, 'Taxable supply', 'Income from sale of goods'),
  ('4100', 'Other Income', 'Revenue', true, NULL, 'Miscellaneous income'),
  ('5000', 'Cost of Goods Sold', 'Expense', true, NULL, 'Direct cost of goods sold'),
  ('5100', 'Purchase Discounts & Returns', 'Expense', true, 'Credit notes', 'Discounts received and purchase returns'),
  ('6000', 'Freight & Logistics', 'Expense', true, NULL, 'Shipping, freight, and logistics costs'),
  ('6100', 'General & Admin Expenses', 'Expense', true, NULL, 'General administrative and operating expenses'),
  ('6200', 'Salary & Wages', 'Expense', true, NULL, 'Employee salaries and wages'),
  ('6300', 'Rent & Utilities', 'Expense', true, NULL, 'Office and warehouse rent, electricity, water'),
  ('6400', 'Marketing & Advertising', 'Expense', true, NULL, 'Promotional and advertising expenses'),
  ('6500', 'Loss on Inventory Write-off', 'Expense', true, NULL, 'Losses from damaged, expired, or written-off stock'),
  ('6600', 'Commission Expense', 'Expense', true, NULL, 'Commission paid to agents and distributors')
ON CONFLICT (code) DO NOTHING;

-- Set parent_id for sub-accounts
-- Assets: 1210 (Goods In Transit) is a sub-account of 1200 (Inventory)
-- ITC accounts (1300-1302) are standalone Asset accounts, NOT under Inventory
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '1200')
WHERE code = '1210';

-- Liabilities: GST Payable and TDS are sub-accounts of Accounts Payable
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '2000')
WHERE code IN ('2100', '2101', '2102', '2200');

-- Equity: Retained Earnings is sub-account of Capital
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '3000')
WHERE code = '3100';

-- Expenses: Purchase Discounts is sub-account of COGS
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '5000')
WHERE code = '5100';

-- Expenses: Detailed expense categories under General & Admin
UPDATE chart_of_accounts SET parent_id = (SELECT id FROM chart_of_accounts WHERE code = '6100')
WHERE code IN ('6200', '6300', '6400', '6500', '6600');
