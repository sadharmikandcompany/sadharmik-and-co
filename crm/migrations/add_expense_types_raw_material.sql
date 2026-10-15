-- Add raw-material / packaging / travel expense types:
-- wheat, oil, ghee, spices, pp_bag, box, sticker, traveling, fuel, office_supplies, stationery.
-- Keep in sync with lib/expense-types.ts.
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check CHECK (
  expense_type = ANY (ARRAY[
    'loan', 'daily_expenses', 'rent', 'utilities', 'salary', 'wages',
    'transportation', 'maintenance', 'marketing', 'insurance', 'other',
    'wheat', 'oil', 'ghee', 'spices', 'pp_bag', 'box', 'sticker', 'traveling',
    'fuel', 'office_supplies', 'stationery'
  ]::text[])
);
