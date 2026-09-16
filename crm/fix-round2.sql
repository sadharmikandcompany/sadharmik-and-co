-- Fix round 2: decouple users from auth.users, sync all CHECK constraints to current production, re-disable RLS

-- 1. Allow inserting production user profiles without matching sandbox auth.users rows
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Sync every CHECK constraint to production's current definition (business rules may have evolved since the schema dump)
DO $$ BEGIN
  ALTER TABLE accounting_periods DROP CONSTRAINT IF EXISTS accounting_periods_status_check;
  ALTER TABLE accounting_periods ADD CONSTRAINT accounting_periods_status_check CHECK (((status)::text = ANY ((ARRAY['Open'::character varying, 'Closed'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'accounting_periods_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE ap_invoices DROP CONSTRAINT IF EXISTS ap_invoices_status_check;
  ALTER TABLE ap_invoices ADD CONSTRAINT ap_invoices_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'paid'::character varying, 'partially_paid'::character varying, 'cancelled'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'ap_invoices_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_session_type_check;
  ALTER TABLE attendance ADD CONSTRAINT attendance_session_type_check CHECK ((session_type = ANY (ARRAY['work'::text, 'break'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'attendance_session_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_txn_type_check;
  ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_txn_type_check CHECK (((txn_type)::text = ANY ((ARRAY['Dr'::character varying, 'Cr'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'bank_transactions_txn_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_status_check;
  ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_status_check CHECK (((status)::text = ANY ((ARRAY['unmatched'::character varying, 'matched'::character varying, 'ignored'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'bank_transactions_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE blogs DROP CONSTRAINT IF EXISTS blogs_status_check;
  ALTER TABLE blogs ADD CONSTRAINT blogs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'blogs_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_type_check;
  ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_type_check CHECK (((type)::text = ANY ((ARRAY['Asset'::character varying, 'Liability'::character varying, 'Equity'::character varying, 'Revenue'::character varying, 'Expense'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'chart_of_accounts_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE credit_notes DROP CONSTRAINT IF EXISTS credit_notes_party_type_check;
  ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_party_type_check CHECK ((party_type = ANY (ARRAY['customer'::text, 'vendor'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'credit_notes_party_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE credit_notes DROP CONSTRAINT IF EXISTS credit_notes_status_check;
  ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'cancelled'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'credit_notes_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE customers DROP CONSTRAINT IF EXISTS valid_pan_format;
  ALTER TABLE customers ADD CONSTRAINT valid_pan_format CHECK (((pan_card_number IS NULL) OR ((length((pan_card_number)::text) = 10) AND ((pan_card_number)::text ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$'::text))));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_pan_format', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_check;
  ALTER TABLE customers ADD CONSTRAINT customers_email_check CHECK (((email IS NULL) OR (email = ''::text) OR (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'customers_email_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE customers DROP CONSTRAINT IF EXISTS valid_gst;
  ALTER TABLE customers ADD CONSTRAINT valid_gst CHECK (((gst_number IS NULL) OR (length(gst_number) = 15)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_gst', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE customers DROP CONSTRAINT IF EXISTS valid_email;
  ALTER TABLE customers ADD CONSTRAINT valid_email CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_email', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE daily_cash_reconciliation DROP CONSTRAINT IF EXISTS daily_cash_reconciliation_reconciliation_status_check;
  ALTER TABLE daily_cash_reconciliation ADD CONSTRAINT daily_cash_reconciliation_reconciliation_status_check CHECK ((reconciliation_status = ANY (ARRAY['pending'::text, 'completed'::text, 'discrepancy'::text, 'resolved'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'daily_cash_reconciliation_reconciliation_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE debit_notes DROP CONSTRAINT IF EXISTS debit_notes_party_type_check;
  ALTER TABLE debit_notes ADD CONSTRAINT debit_notes_party_type_check CHECK ((party_type = ANY (ARRAY['customer'::text, 'vendor'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'debit_notes_party_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE debit_notes DROP CONSTRAINT IF EXISTS debit_notes_status_check;
  ALTER TABLE debit_notes ADD CONSTRAINT debit_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'cancelled'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'debit_notes_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partner_stock DROP CONSTRAINT IF EXISTS total_accounted;
  ALTER TABLE delivery_partner_stock ADD CONSTRAINT total_accounted CHECK ((((delivered_quantity + returned_quantity) + damaged_quantity) <= quantity));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'total_accounted', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partner_stock DROP CONSTRAINT IF EXISTS delivery_partner_stock_status_check;
  ALTER TABLE delivery_partner_stock ADD CONSTRAINT delivery_partner_stock_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'picked_up'::text, 'in_transit'::text, 'delivered'::text, 'partially_delivered'::text, 'returned'::text, 'cancelled'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'delivery_partner_stock_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partner_stock DROP CONSTRAINT IF EXISTS valid_returned_quantity;
  ALTER TABLE delivery_partner_stock ADD CONSTRAINT valid_returned_quantity CHECK (((returned_quantity >= 0) AND (returned_quantity <= quantity)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_returned_quantity', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partner_stock DROP CONSTRAINT IF EXISTS valid_damaged_quantity;
  ALTER TABLE delivery_partner_stock ADD CONSTRAINT valid_damaged_quantity CHECK (((damaged_quantity >= 0) AND (damaged_quantity <= quantity)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_damaged_quantity', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partner_stock DROP CONSTRAINT IF EXISTS positive_quantity;
  ALTER TABLE delivery_partner_stock ADD CONSTRAINT positive_quantity CHECK ((quantity > 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'positive_quantity', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partner_stock DROP CONSTRAINT IF EXISTS valid_delivered_quantity;
  ALTER TABLE delivery_partner_stock ADD CONSTRAINT valid_delivered_quantity CHECK (((delivered_quantity >= 0) AND (delivered_quantity <= quantity)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_delivered_quantity', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partners DROP CONSTRAINT IF EXISTS delivery_partners_total_deliveries_check;
  ALTER TABLE delivery_partners ADD CONSTRAINT delivery_partners_total_deliveries_check CHECK ((total_deliveries >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'delivery_partners_total_deliveries_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_partners DROP CONSTRAINT IF EXISTS delivery_partners_average_rating_check;
  ALTER TABLE delivery_partners ADD CONSTRAINT delivery_partners_average_rating_check CHECK (((average_rating >= (0)::numeric) AND (average_rating <= (5)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'delivery_partners_average_rating_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_review_items DROP CONSTRAINT IF EXISTS delivery_review_items_verified_status_check;
  ALTER TABLE delivery_review_items ADD CONSTRAINT delivery_review_items_verified_status_check CHECK ((verified_status = ANY (ARRAY['verified'::text, 'disputed'::text, 'pending'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'delivery_review_items_verified_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_reviews DROP CONSTRAINT IF EXISTS delivery_reviews_review_status_check;
  ALTER TABLE delivery_reviews ADD CONSTRAINT delivery_reviews_review_status_check CHECK ((review_status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'disputed'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'delivery_reviews_review_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE delivery_reviews DROP CONSTRAINT IF EXISTS delivery_reviews_settlement_status_check;
  ALTER TABLE delivery_reviews ADD CONSTRAINT delivery_reviews_settlement_status_check CHECK ((settlement_status = ANY (ARRAY['pending'::text, 'partial'::text, 'complete'::text, 'disputed'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'delivery_reviews_settlement_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE distributor_payments DROP CONSTRAINT IF EXISTS distributor_payments_amount_check;
  ALTER TABLE distributor_payments ADD CONSTRAINT distributor_payments_amount_check CHECK ((amount > (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'distributor_payments_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_amount_check;
  ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'expenses_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
  ALTER TABLE expenses ADD CONSTRAINT expenses_expense_type_check CHECK ((expense_type = ANY (ARRAY['loan'::text, 'daily_expenses'::text, 'rent'::text, 'utilities'::text, 'salary'::text, 'wages'::text, 'transportation'::text, 'maintenance'::text, 'marketing'::text, 'insurance'::text, 'other'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'expenses_expense_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_expense_category_check;
  ALTER TABLE expenses ADD CONSTRAINT expenses_expense_category_check CHECK ((expense_category = ANY (ARRAY['direct'::text, 'indirect'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'expenses_expense_category_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
  ALTER TABLE expenses ADD CONSTRAINT expenses_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'upi'::text, 'bank_transfer'::text, 'cheque'::text, 'balance'::text, 'card'::text, 'net_banking'::text, 'other'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'expenses_payment_method_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE factory_warehouse_stock DROP CONSTRAINT IF EXISTS factory_warehouse_stock_reserved_quantity_check;
  ALTER TABLE factory_warehouse_stock ADD CONSTRAINT factory_warehouse_stock_reserved_quantity_check CHECK ((reserved_quantity >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'factory_warehouse_stock_reserved_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE factory_warehouse_stock DROP CONSTRAINT IF EXISTS factory_warehouse_stock_quantity_check;
  ALTER TABLE factory_warehouse_stock ADD CONSTRAINT factory_warehouse_stock_quantity_check CHECK ((quantity >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'factory_warehouse_stock_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE godown_stock DROP CONSTRAINT IF EXISTS reserved_logical;
  ALTER TABLE godown_stock ADD CONSTRAINT reserved_logical CHECK (
CASE
    WHEN (quantity >= 0) THEN (reserved_quantity <= quantity)
    ELSE (reserved_quantity = 0)
END);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'reserved_logical', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE godown_stock DROP CONSTRAINT IF EXISTS positive_reserved;
  ALTER TABLE godown_stock ADD CONSTRAINT positive_reserved CHECK ((reserved_quantity >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'positive_reserved', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE godowns DROP CONSTRAINT IF EXISTS godown_owner_check;
  ALTER TABLE godowns ADD CONSTRAINT godown_owner_check CHECK ((((godown_type = 'company'::text) AND (distributor_id IS NULL) AND (retailer_id IS NULL)) OR ((godown_type = 'distributor'::text) AND (distributor_id IS NOT NULL) AND (retailer_id IS NULL)) OR ((godown_type = 'retailer'::text) AND (retailer_id IS NOT NULL) AND (distributor_id IS NULL))));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'godown_owner_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE godowns DROP CONSTRAINT IF EXISTS godowns_godown_type_check;
  ALTER TABLE godowns ADD CONSTRAINT godowns_godown_type_check CHECK ((godown_type = ANY (ARRAY['company'::text, 'distributor'::text, 'retailer'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'godowns_godown_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE goods_receipt_notes DROP CONSTRAINT IF EXISTS goods_receipt_notes_status_check;
  ALTER TABLE goods_receipt_notes ADD CONSTRAINT goods_receipt_notes_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'qc_hold'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'goods_receipt_notes_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_status_check;
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Reversed'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'journal_entries_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE lab_tests DROP CONSTRAINT IF EXISTS lab_tests_status_check;
  ALTER TABLE lab_tests ADD CONSTRAINT lab_tests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'lab_tests_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE loose_stock DROP CONSTRAINT IF EXISTS loose_stock_quantity_liters_check;
  ALTER TABLE loose_stock ADD CONSTRAINT loose_stock_quantity_liters_check CHECK ((quantity_liters >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'loose_stock_quantity_liters_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE loose_stock_transactions DROP CONSTRAINT IF EXISTS loose_stock_transactions_transaction_type_check;
  ALTER TABLE loose_stock_transactions ADD CONSTRAINT loose_stock_transactions_transaction_type_check CHECK (((transaction_type)::text = ANY (ARRAY[('purchase'::character varying)::text, ('transfer'::character varying)::text, ('adjustment'::character varying)::text, ('opening'::character varying)::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'loose_stock_transactions_transaction_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE myoperator_latest_call DROP CONSTRAINT IF EXISTS myoperator_latest_call_id_check;
  ALTER TABLE myoperator_latest_call ADD CONSTRAINT myoperator_latest_call_id_check CHECK ((id = 1));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'myoperator_latest_call_id_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE myoperator_whatsapp_messages DROP CONSTRAINT IF EXISTS myoperator_whatsapp_messages_direction_check;
  ALTER TABLE myoperator_whatsapp_messages ADD CONSTRAINT myoperator_whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'myoperator_whatsapp_messages_direction_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE opening_stock_entries DROP CONSTRAINT IF EXISTS opening_stock_entries_stock_type_check;
  ALTER TABLE opening_stock_entries ADD CONSTRAINT opening_stock_entries_stock_type_check CHECK ((stock_type = ANY (ARRAY['warehouse'::text, 'distributor'::text, 'retailer'::text, 'manufacturing'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'opening_stock_entries_stock_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE opening_stock_entries DROP CONSTRAINT IF EXISTS opening_stock_location_match;
  ALTER TABLE opening_stock_entries ADD CONSTRAINT opening_stock_location_match CHECK ((((stock_type = 'warehouse'::text) AND (godown_id IS NOT NULL)) OR ((stock_type = 'distributor'::text) AND (distributor_id IS NOT NULL)) OR ((stock_type = 'retailer'::text) AND (retailer_id IS NOT NULL)) OR (stock_type = 'manufacturing'::text)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'opening_stock_location_match', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE opening_stock_entries DROP CONSTRAINT IF EXISTS opening_stock_entries_quantity_check;
  ALTER TABLE opening_stock_entries ADD CONSTRAINT opening_stock_entries_quantity_check CHECK ((quantity >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'opening_stock_entries_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_change_requests DROP CONSTRAINT IF EXISTS order_change_requests_request_status_check;
  ALTER TABLE order_change_requests ADD CONSTRAINT order_change_requests_request_status_check CHECK ((request_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_change_requests_request_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_change_requests DROP CONSTRAINT IF EXISTS order_change_requests_request_type_check;
  ALTER TABLE order_change_requests ADD CONSTRAINT order_change_requests_request_type_check CHECK ((request_type = ANY (ARRAY['item_change'::text, 'quantity_change'::text, 'address_change'::text, 'other'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_change_requests_request_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_subtotal_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_subtotal_check CHECK ((subtotal >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_items_subtotal_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_unit_price_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_unit_price_check CHECK ((unit_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_items_unit_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_discount_percent_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_items_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_total_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_total_check CHECK ((total >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_items_total_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_discount_amount_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_discount_amount_check CHECK ((discount_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_items_discount_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_quantity_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check CHECK ((quantity > 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'order_items_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_subtotal_check;
  ALTER TABLE orders ADD CONSTRAINT orders_subtotal_check CHECK ((subtotal >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_subtotal_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS check_shipping_address;
  ALTER TABLE orders ADD CONSTRAINT check_shipping_address CHECK (((shipping_full_address IS NOT NULL) OR ((shipping_building_name IS NOT NULL) AND (shipping_street_area IS NOT NULL) AND (shipping_city IS NOT NULL) AND (shipping_state IS NOT NULL) AND (shipping_pincode IS NOT NULL))));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'check_shipping_address', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_source_check;
  ALTER TABLE orders ADD CONSTRAINT orders_source_check CHECK ((source = ANY (ARRAY['online'::text, 'backend'::text, 'website'::text, 'mobile'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_source_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_discount_amount_check;
  ALTER TABLE orders ADD CONSTRAINT orders_discount_amount_check CHECK ((discount_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_discount_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_payment_status;
  ALTER TABLE orders ADD CONSTRAINT valid_payment_status CHECK ((payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'refunded'::text, 'partially_refunded'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_payment_status', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shipping_charges_check;
  ALTER TABLE orders ADD CONSTRAINT orders_shipping_charges_check CHECK ((shipping_charges >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_shipping_charges_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_gst_amount_check;
  ALTER TABLE orders ADD CONSTRAINT orders_gst_amount_check CHECK ((gst_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_gst_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_tax_amount_check;
  ALTER TABLE orders ADD CONSTRAINT orders_tax_amount_check CHECK ((tax_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_tax_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_total_amount_check;
  ALTER TABLE orders ADD CONSTRAINT orders_total_amount_check CHECK ((total_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'orders_total_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS valid_order_status;
  ALTER TABLE orders ADD CONSTRAINT valid_order_status CHECK ((order_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'packed'::text, 'shipped'::text, 'out_for_delivery'::text, 'delivered'::text, 'cancelled'::text, 'returned'::text, 'refunded'::text, 'failed'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_order_status', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE packaging_materials DROP CONSTRAINT IF EXISTS check_material_type;
  ALTER TABLE packaging_materials ADD CONSTRAINT check_material_type CHECK ((material_type = ANY (ARRAY['content'::text, 'packaging'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'check_material_type', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE payment_outs DROP CONSTRAINT IF EXISTS payment_outs_discount_percent_check;
  ALTER TABLE payment_outs ADD CONSTRAINT payment_outs_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'payment_outs_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE payment_outs DROP CONSTRAINT IF EXISTS payment_outs_payment_type_check;
  ALTER TABLE payment_outs ADD CONSTRAINT payment_outs_payment_type_check CHECK ((payment_type = ANY (ARRAY['cash'::text, 'upi'::text, 'bank_transfer'::text, 'cheque'::text, 'card'::text, 'net_banking'::text, 'other'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'payment_outs_payment_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE payment_outs DROP CONSTRAINT IF EXISTS payment_outs_paid_amount_check;
  ALTER TABLE payment_outs ADD CONSTRAINT payment_outs_paid_amount_check CHECK ((paid_amount > (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'payment_outs_paid_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_distributor_sale_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_distributor_sale_price_check CHECK (((distributor_sale_price IS NULL) OR (distributor_sale_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_distributor_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_distributor_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_distributor_price_check CHECK (((distributor_price IS NULL) OR (distributor_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_distributor_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_customer_sale_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_customer_sale_price_check CHECK (((customer_sale_price IS NULL) OR (customer_sale_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_customer_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_customer_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_customer_price_check CHECK (((customer_price IS NULL) OR (customer_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_customer_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_retailer_sale_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_retailer_sale_price_check CHECK (((retailer_sale_price IS NULL) OR (retailer_sale_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_retailer_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_retailer_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_retailer_price_check CHECK (((retailer_price IS NULL) OR (retailer_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_retailer_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_sub_distributor_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_sub_distributor_price_check CHECK (((sub_distributor_price IS NULL) OR (sub_distributor_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_sub_distributor_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE product_pincode_pricing DROP CONSTRAINT IF EXISTS product_pincode_pricing_sub_distributor_sale_price_check;
  ALTER TABLE product_pincode_pricing ADD CONSTRAINT product_pincode_pricing_sub_distributor_sale_price_check CHECK (((sub_distributor_sale_price IS NULL) OR (sub_distributor_sale_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'product_pincode_pricing_sub_distributor_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS distributor_sale_valid;
  ALTER TABLE products ADD CONSTRAINT distributor_sale_valid CHECK (((distributor_sale_price IS NULL) OR (distributor_sale_price <= distributor_price)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'distributor_sale_valid', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_gst_percentage_check;
  ALTER TABLE products ADD CONSTRAINT products_gst_percentage_check CHECK (((gst_percentage >= (0)::numeric) AND (gst_percentage <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_gst_percentage_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_check;
  ALTER TABLE products ADD CONSTRAINT products_stock_check CHECK ((stock >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_stock_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_customer_price_check;
  ALTER TABLE products ADD CONSTRAINT products_customer_price_check CHECK ((customer_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_customer_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_customer_sale_price_check;
  ALTER TABLE products ADD CONSTRAINT products_customer_sale_price_check CHECK ((customer_sale_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_customer_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_customer_discount_percent_check;
  ALTER TABLE products ADD CONSTRAINT products_customer_discount_percent_check CHECK (((customer_discount_percent >= (0)::numeric) AND (customer_discount_percent <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_customer_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_distributor_price_check;
  ALTER TABLE products ADD CONSTRAINT products_distributor_price_check CHECK ((distributor_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_distributor_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_distributor_sale_price_check;
  ALTER TABLE products ADD CONSTRAINT products_distributor_sale_price_check CHECK ((distributor_sale_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_distributor_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_distributor_discount_percent_check;
  ALTER TABLE products ADD CONSTRAINT products_distributor_discount_percent_check CHECK (((distributor_discount_percent >= (0)::numeric) AND (distributor_discount_percent <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_distributor_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sub_distributor_price_check;
  ALTER TABLE products ADD CONSTRAINT products_sub_distributor_price_check CHECK ((sub_distributor_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_sub_distributor_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sub_distributor_sale_price_check;
  ALTER TABLE products ADD CONSTRAINT products_sub_distributor_sale_price_check CHECK ((sub_distributor_sale_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_sub_distributor_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sub_distributor_discount_percent_check;
  ALTER TABLE products ADD CONSTRAINT products_sub_distributor_discount_percent_check CHECK (((sub_distributor_discount_percent >= (0)::numeric) AND (sub_distributor_discount_percent <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_sub_distributor_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS customer_sale_valid;
  ALTER TABLE products ADD CONSTRAINT customer_sale_valid CHECK (((customer_sale_price IS NULL) OR (customer_sale_price <= customer_price)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'customer_sale_valid', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS sub_distributor_sale_valid;
  ALTER TABLE products ADD CONSTRAINT sub_distributor_sale_valid CHECK (((sub_distributor_sale_price IS NULL) OR (sub_distributor_sale_price <= sub_distributor_price)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'sub_distributor_sale_valid', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_retailer_price_check;
  ALTER TABLE products ADD CONSTRAINT products_retailer_price_check CHECK (((retailer_price IS NULL) OR (retailer_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_retailer_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_retailer_sale_price_check;
  ALTER TABLE products ADD CONSTRAINT products_retailer_sale_price_check CHECK (((retailer_sale_price IS NULL) OR (retailer_sale_price >= (0)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_retailer_sale_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_retailer_discount_percent_check;
  ALTER TABLE products ADD CONSTRAINT products_retailer_discount_percent_check CHECK (((retailer_discount_percent IS NULL) OR ((retailer_discount_percent >= (0)::numeric) AND (retailer_discount_percent <= (100)::numeric))));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'products_retailer_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_subtotal_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_subtotal_check CHECK ((subtotal >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_subtotal_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_total_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_total_check CHECK ((total >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_total_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_received_quantity_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_received_quantity_check CHECK ((received_quantity >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_received_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_quantity_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_quantity_check CHECK ((quantity > 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_unit_price_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_unit_price_check CHECK ((unit_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_unit_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_discount_percent_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_discount_percent_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchase_items DROP CONSTRAINT IF EXISTS purchase_items_discount_amount_check;
  ALTER TABLE purchase_items ADD CONSTRAINT purchase_items_discount_amount_check CHECK ((discount_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchase_items_discount_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_discount_amount_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_discount_amount_check CHECK ((discount_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_discount_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_tax_amount_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_tax_amount_check CHECK ((tax_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_tax_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_total_amount_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_total_amount_check CHECK ((total_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_total_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_shipping_charges_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_shipping_charges_check CHECK ((shipping_charges >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_shipping_charges_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_gst_amount_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_gst_amount_check CHECK ((gst_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_gst_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_payment_status_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'partial'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_payment_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_paid_amount_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_paid_amount_check CHECK ((paid_amount >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_paid_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_purchase_status_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_purchase_status_check CHECK ((purchase_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'received'::text, 'partially_received'::text, 'cancelled'::text, 'returned'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_purchase_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_subtotal_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_subtotal_check CHECK ((subtotal >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_subtotal_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_other_charges_check;
  ALTER TABLE purchases ADD CONSTRAINT purchases_other_charges_check CHECK ((other_charges >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'purchases_other_charges_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE retailer_payments DROP CONSTRAINT IF EXISTS retailer_payments_amount_check;
  ALTER TABLE retailer_payments ADD CONSTRAINT retailer_payments_amount_check CHECK ((amount > (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'retailer_payments_amount_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;
  ALTER TABLE reviews ADD CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'reviews_rating_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE route_assignments DROP CONSTRAINT IF EXISTS valid_assignment_status;
  ALTER TABLE route_assignments ADD CONSTRAINT valid_assignment_status CHECK ((status = ANY (ARRAY['assigned'::text, 'picked_up'::text, 'in_transit'::text, 'out_for_delivery'::text, 'delivered'::text, 'failed'::text, 'returned'::text, 'cancelled'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_assignment_status', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE route_assignments DROP CONSTRAINT IF EXISTS route_assignments_customer_rating_check;
  ALTER TABLE route_assignments ADD CONSTRAINT route_assignments_customer_rating_check CHECK (((customer_rating >= 1) AND (customer_rating <= 5)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'route_assignments_customer_rating_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE routes DROP CONSTRAINT IF EXISTS pincodes_not_empty;
  ALTER TABLE routes ADD CONSTRAINT pincodes_not_empty CHECK ((array_length(pincodes, 1) > 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'pincodes_not_empty', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_batches DROP CONSTRAINT IF EXISTS stock_batches_check;
  ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_check CHECK (((expiry_date IS NULL) OR (mfg_date IS NULL) OR (expiry_date >= mfg_date)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_batches_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_batches DROP CONSTRAINT IF EXISTS stock_batches_status_check;
  ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'consumed'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_batches_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_inventory DROP CONSTRAINT IF EXISTS stock_inventory_quantity_check;
  ALTER TABLE stock_inventory ADD CONSTRAINT stock_inventory_quantity_check CHECK ((quantity >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_inventory_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_inventory DROP CONSTRAINT IF EXISTS stock_inventory_price_check;
  ALTER TABLE stock_inventory ADD CONSTRAINT stock_inventory_price_check CHECK ((price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_inventory_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_inventory DROP CONSTRAINT IF EXISTS stock_inventory_min_stock_check;
  ALTER TABLE stock_inventory ADD CONSTRAINT stock_inventory_min_stock_check CHECK ((min_stock >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_inventory_min_stock_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_inventory DROP CONSTRAINT IF EXISTS check_material_or_product;
  ALTER TABLE stock_inventory ADD CONSTRAINT check_material_or_product CHECK ((((material_id IS NOT NULL) AND (product_id IS NULL)) OR ((material_id IS NULL) AND (product_id IS NOT NULL))));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'check_material_or_product', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS stock_ledger_txn_type_check;
  ALTER TABLE stock_ledger ADD CONSTRAINT stock_ledger_txn_type_check CHECK (((txn_type)::text = ANY ((ARRAY['PURCHASE_RECEIPT'::character varying, 'SALE_ISSUE'::character varying, 'TRANSFER_IN'::character varying, 'TRANSFER_OUT'::character varying, 'ADJUSTMENT'::character varying, 'WRITE_OFF'::character varying, 'OPENING_BALANCE'::character varying, 'RETURN_IN'::character varying, 'RETURN_OUT'::character varying, 'PRODUCTION_IN'::character varying, 'PRODUCTION_OUT'::character varying])::text[])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_ledger_txn_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_transfer_items DROP CONSTRAINT IF EXISTS stock_transfer_items_quantity_check;
  ALTER TABLE stock_transfer_items ADD CONSTRAINT stock_transfer_items_quantity_check CHECK ((quantity > 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_transfer_items_quantity_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS positive_transfer_quantity;
  ALTER TABLE stock_transfers ADD CONSTRAINT positive_transfer_quantity CHECK ((quantity > 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'positive_transfer_quantity', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS different_godowns;
  ALTER TABLE stock_transfers ADD CONSTRAINT different_godowns CHECK ((from_godown_id <> to_godown_id));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'different_godowns', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_transfer_status_check;
  ALTER TABLE stock_transfers ADD CONSTRAINT stock_transfers_transfer_status_check CHECK ((transfer_status = ANY (ARRAY['pending'::text, 'in_transit'::text, 'completed'::text, 'cancelled'::text, 'rejected'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'stock_transfers_transfer_status_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS valid_priority;
  ALTER TABLE support_tickets ADD CONSTRAINT valid_priority CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text, 'critical'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_priority', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS valid_source;
  ALTER TABLE support_tickets ADD CONSTRAINT valid_source CHECK ((source = ANY (ARRAY['web'::text, 'mobile'::text, 'email'::text, 'phone'::text, 'chat'::text, 'social_media'::text, 'whatsapp'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_source', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS valid_category;
  ALTER TABLE support_tickets ADD CONSTRAINT valid_category CHECK ((category = ANY (ARRAY['order_issue'::text, 'delivery_issue'::text, 'product_inquiry'::text, 'payment_issue'::text, 'refund_request'::text, 'complaint'::text, 'technical_issue'::text, 'account_issue'::text, 'feedback'::text, 'other'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_category', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS valid_ticket_status;
  ALTER TABLE support_tickets ADD CONSTRAINT valid_ticket_status CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'pending_customer'::text, 'on_hold'::text, 'resolved'::text, 'closed'::text, 'cancelled'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_ticket_status', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_satisfaction_rating_check;
  ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_satisfaction_rating_check CHECK (((satisfaction_rating >= 1) AND (satisfaction_rating <= 5)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'support_tickets_satisfaction_rating_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE ticket_messages DROP CONSTRAINT IF EXISTS valid_sender_type;
  ALTER TABLE ticket_messages ADD CONSTRAINT valid_sender_type CHECK ((sender_type = ANY (ARRAY['customer'::text, 'agent'::text, 'system'::text, 'bot'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'valid_sender_type', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE variant_material_mapping DROP CONSTRAINT IF EXISTS variant_material_mapping_quantity_per_unit_check;
  ALTER TABLE variant_material_mapping ADD CONSTRAINT variant_material_mapping_quantity_per_unit_check CHECK ((quantity_per_unit > (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'variant_material_mapping_quantity_per_unit_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE variant_material_mapping DROP CONSTRAINT IF EXISTS variant_material_mapping_liters_consumed_per_unit_check;
  ALTER TABLE variant_material_mapping ADD CONSTRAINT variant_material_mapping_liters_consumed_per_unit_check CHECK ((liters_consumed_per_unit >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'variant_material_mapping_liters_consumed_per_unit_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE vendor_stock DROP CONSTRAINT IF EXISTS vendor_stock_vendor_price_check;
  ALTER TABLE vendor_stock ADD CONSTRAINT vendor_stock_vendor_price_check CHECK ((vendor_price >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'vendor_stock_vendor_price_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_vendor_type_check;
  ALTER TABLE vendors ADD CONSTRAINT vendors_vendor_type_check CHECK ((vendor_type = ANY (ARRAY['manufacturer'::text, 'wholesaler'::text, 'distributor'::text, 'trader'::text, 'importer'::text, 'other'::text])));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'vendors_vendor_type_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_email_check;
  ALTER TABLE vendors ADD CONSTRAINT vendors_email_check CHECK (((email IS NULL) OR (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'vendors_email_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_gst_number_check;
  ALTER TABLE vendors ADD CONSTRAINT vendors_gst_number_check CHECK (((gst_number IS NULL) OR (length(gst_number) = 15)));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'vendors_gst_number_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_credit_limit_check;
  ALTER TABLE vendors ADD CONSTRAINT vendors_credit_limit_check CHECK ((credit_limit >= (0)::numeric));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'vendors_credit_limit_check', SQLERRM;
END $$;
DO $$ BEGIN
  ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_credit_days_check;
  ALTER TABLE vendors ADD CONSTRAINT vendors_credit_days_check CHECK ((credit_days >= 0));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip % : %', 'vendors_credit_days_check', SQLERRM;
END $$;

-- 3. Re-disable RLS on everything (safety net)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
