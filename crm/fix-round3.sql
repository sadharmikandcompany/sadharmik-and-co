-- Drop FKs that point directly at auth.users (sandbox only has 1 real login, not all 30 production users)
ALTER TABLE public.stock_comments DROP CONSTRAINT IF EXISTS stock_comments_user_id_fkey;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_created_by_user_id_fkey;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_fkey;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_created_by_fkey;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_updated_by_fkey;
ALTER TABLE public.delivery_reviews DROP CONSTRAINT IF EXISTS delivery_reviews_reviewer_id_fkey;
ALTER TABLE public.daily_cash_reconciliation DROP CONSTRAINT IF EXISTS daily_cash_reconciliation_reviewer_id_fkey;
ALTER TABLE public.daily_cash_reconciliation DROP CONSTRAINT IF EXISTS daily_cash_reconciliation_approved_by_fkey;
