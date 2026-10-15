// Single source of truth for expenses.expense_type. Values must match the
// expenses_expense_type_check constraint (see migrations/add_expense_types_raw_material.sql).
export type ExpenseTypeOption = { value: string; label: string }

export const GENERAL_EXPENSE_TYPES: ExpenseTypeOption[] = [
  { value: "loan", label: "Loan Payment" },
  { value: "daily_expenses", label: "Daily Expenses" },
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities (Electricity, Water, etc.)" },
  { value: "salary", label: "Salary" },
  { value: "wages", label: "Wages" },
  { value: "transportation", label: "Transportation" },
  { value: "traveling", label: "Traveling" },
  { value: "fuel", label: "Fuel" },
  { value: "office_supplies", label: "Office Supplies" },
  { value: "stationery", label: "Stationery" },
  { value: "maintenance", label: "Maintenance & Repairs" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
]

export const MATERIAL_EXPENSE_TYPES: ExpenseTypeOption[] = [
  { value: "wheat", label: "Wheat" },
  { value: "oil", label: "Oil" },
  { value: "ghee", label: "Ghee" },
  { value: "spices", label: "Spices" },
  { value: "pp_bag", label: "PP Bag" },
  { value: "box", label: "Box" },
  { value: "sticker", label: "Sticker" },
]

export const EXPENSE_TYPE_GROUPS: { heading: string; options: ExpenseTypeOption[] }[] = [
  { heading: "General", options: GENERAL_EXPENSE_TYPES },
  { heading: "Raw Material & Packaging", options: MATERIAL_EXPENSE_TYPES },
]

export const EXPENSE_TYPES: ExpenseTypeOption[] = [...GENERAL_EXPENSE_TYPES, ...MATERIAL_EXPENSE_TYPES]

export const expenseTypeLabel = (value: string | null | undefined): string => {
  if (!value) return ""
  return EXPENSE_TYPES.find((t) => t.value === value.toLowerCase())?.label ?? value.replace(/_/g, " ")
}
