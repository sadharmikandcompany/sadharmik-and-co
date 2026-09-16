-- Add expense_category column (direct / indirect) to expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_category text
    CHECK (expense_category = ANY (ARRAY['direct'::text, 'indirect'::text]));

CREATE INDEX IF NOT EXISTS idx_expenses_expense_category
  ON public.expenses (expense_category);
