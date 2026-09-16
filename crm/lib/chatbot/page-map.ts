/**
 * Page map injected into the AI chatbot's system prompt.
 * Keeps the model anchored to real routes when navigating.
 *
 * Mirrors admin-visible routes from components/app-sidebar.tsx.
 */

export interface PageInfo {
  path: string
  title: string
  description: string
}

export const ADMIN_PAGES: PageInfo[] = [
  // Overview
  { path: "/dashboard", title: "Dashboard", description: "Admin home — overview cards and quick stats." },
  { path: "/dashboard/dashboard-v2", title: "Dashboard V2", description: "Newer admin dashboard with extended analytics." },
  { path: "/dashboard/announcements", title: "Announcements", description: "Manage broadcast announcements shown across the app." },
  { path: "/dashboard/blogs", title: "Blogs", description: "Author and edit blog posts shown on the public site." },
  { path: "/dashboard/lab-tests", title: "Lab Tests", description: "Lab-test reports for product batches; visible publicly." },
  { path: "/dashboard/lab-tests/new", title: "New Lab Test", description: "Create a new lab test entry." },
  { path: "/dashboard/licenses", title: "Licenses", description: "Compliance and regulatory licenses shown on the website." },
  { path: "/dashboard/licenses/new", title: "New License", description: "Upload a new license image or PDF." },
  { path: "/dashboard/reviews", title: "Reviews", description: "Product reviews displayed on the public site." },
  { path: "/dashboard/reviews/new", title: "New Review", description: "Add a product review (supports AI generation)." },

  // Support
  { path: "/dashboard/support", title: "Customer Support", description: "Customer support workspace." },
  { path: "/dashboard/myoperator", title: "MyOperator", description: "Telephony/IVR (MyOperator integration)." },
  { path: "/dashboard/tickets", title: "Support Tickets", description: "Ticket queue and resolution." },

  // Customer Engagement
  { path: "/dashboard/payment-collection", title: "Payment Collection", description: "Open balances and collection workflow." },
  { path: "/dashboard/inactive-customers", title: "Inactive Customers", description: "Customers with no recent orders." },

  // Sales & Orders
  { path: "/dashboard/orders", title: "Orders", description: "All sales orders." },
  { path: "/dashboard/orders/actual-stock", title: "Actual Physical Stock", description: "Reconciliation of physical vs system stock." },
  { path: "/dashboard/orders-v2", title: "Orders V2", description: "Newer orders interface." },
  { path: "/dashboard/pos", title: "Point of Sale", description: "POS billing screen." },
  { path: "/dashboard/order-from-factory/new", title: "New Factory Order", description: "Create a factory production order." },
  { path: "/dashboard/warehouse-orders", title: "Warehouse Orders", description: "Warehouse-bound orders." },
  { path: "/dashboard/partner-orders", title: "Partner Orders", description: "Distributor / partner orders." },
  { path: "/dashboard/agent-commissions", title: "Agent Commissions", description: "Commission ledger for agents." },
  { path: "/dashboard/easebuzz-transactions", title: "Easebuzz Transactions", description: "Online payment gateway transactions." },

  // People
  { path: "/dashboard/customers", title: "Customers", description: "All customer records." },
  { path: "/dashboard/customers/v2", title: "Customers V2", description: "Newer customer interface." },
  { path: "/dashboard/users", title: "Users", description: "Internal system users." },
  { path: "/dashboard/attendance", title: "Attendance", description: "Staff attendance ledger." },
  { path: "/dashboard/distributors", title: "Distributors", description: "Distributor accounts." },
  { path: "/dashboard/retailers", title: "Retailers", description: "Retailer accounts." },
  { path: "/dashboard/vendors", title: "Vendors", description: "Vendor / supplier accounts." },
  { path: "/dashboard/delivery-partners", title: "Delivery Partners", description: "Last-mile delivery partner directory." },

  // Logistics
  { path: "/dashboard/route-assignments", title: "Route Assignments", description: "Assign orders to delivery routes." },
  { path: "/dashboard/delivery-sheets", title: "Delivery Sheets", description: "Daily delivery manifests." },
  { path: "/dashboard/ewaybill", title: "E-Way Bill", description: "GST e-way bill generation and tracking." },
  { path: "/dashboard/courier-partners", title: "Courier Partners", description: "Courier partner setup." },
  { path: "/dashboard/shiprocket", title: "Shiprocket Orders", description: "Shiprocket integration." },
  { path: "/dashboard/routes", title: "Routes", description: "Delivery routes." },
  { path: "/dashboard/delivery-reviewer", title: "Delivery Reviewer", description: "Review delivery proofs." },

  // Inventory
  { path: "/dashboard/warehouse-stock", title: "Warehouse Stock", description: "Current stock by warehouse." },
  { path: "/dashboard/stock", title: "Stock Inventory", description: "Stock master." },
  { path: "/dashboard/loose-stock", title: "Loose Stock", description: "Loose / bulk stock." },
  { path: "/dashboard/godowns", title: "Warehouses (Godowns)", description: "Warehouse / godown directory." },
  { path: "/dashboard/stock-transfers", title: "Stock Transfers", description: "Inter-warehouse transfers." },
  { path: "/dashboard/distributor-stock", title: "Distributor Stock", description: "Stock at distributor locations." },
  { path: "/dashboard/retailer-stock", title: "Retailer Stock", description: "Stock at retailer locations." },
  { path: "/dashboard/stock/material-mapping", title: "Material Mapping", description: "Map raw materials to SKUs." },
  { path: "/dashboard/stock-ledger", title: "Stock Ledger", description: "Movement-level stock ledger." },
  { path: "/dashboard/inventory-valuation", title: "Inventory Valuation", description: "Stock valuation report." },
  { path: "/dashboard/stock-write-offs", title: "Stock Write-offs", description: "Damaged / written-off stock." },
  { path: "/dashboard/reorder-management", title: "Reorder Management", description: "Reorder thresholds and PO suggestions." },

  // Products
  { path: "/dashboard/products", title: "Products", description: "Product catalogue." },
  { path: "/dashboard/products-bulk-edit", title: "Products Bulk Editor", description: "Edit many products at once." },
  { path: "/dashboard/categories", title: "Categories", description: "Product categories and subcategories." },

  // Procurement
  { path: "/dashboard/purchases", title: "Purchases", description: "Purchase orders." },
  { path: "/dashboard/goods-receipt-notes", title: "Goods Receipt Notes", description: "GRN entries." },
  { path: "/dashboard/credit-notes", title: "Credit Notes", description: "Credit notes issued." },
  { path: "/dashboard/debit-notes", title: "Debit Notes", description: "Debit notes issued." },
  { path: "/dashboard/expenses", title: "Expenses", description: "Operating expenses." },

  // Accounting
  { path: "/dashboard/accounting/chart-of-accounts", title: "Chart of Accounts", description: "Accounting CoA." },
  { path: "/dashboard/accounting/journal-entries", title: "Journal Entries", description: "Manual journal entries." },
  { path: "/dashboard/accounting/trial-balance", title: "Trial Balance", description: "Trial balance report." },
  { path: "/dashboard/accounting/ledger", title: "Account Ledger", description: "Per-account ledger." },
  { path: "/dashboard/accounting/tax-ledger", title: "Tax Ledger (GST)", description: "GST ledger." },
  { path: "/dashboard/accounting/ap-aging", title: "AP Aging", description: "Accounts payable aging." },
  { path: "/dashboard/accounting/ar-aging", title: "AR Aging", description: "Accounts receivable aging." },
  { path: "/dashboard/accounting/reconciliation", title: "Reconciliation", description: "Bank reconciliation." },
  { path: "/dashboard/accounting/period-close", title: "Period Close", description: "Close accounting periods." },

  // Reports
  { path: "/dashboard/reports/orders", title: "Orders Report", description: "Orders analytics." },
  { path: "/dashboard/reports/purchases", title: "Purchase Report", description: "Purchase analytics." },
  { path: "/dashboard/reports/customers", title: "Customers Report", description: "Customer analytics." },
  { path: "/dashboard/reports/user-transactions", title: "User Transactions", description: "Audit of user activity." },
  { path: "/dashboard/reports/gst-orders", title: "GST Orders Report", description: "GST-relevant orders." },
  { path: "/dashboard/reports/balance-sheet", title: "Balance Sheet", description: "Balance sheet report." },
  { path: "/dashboard/reports/profit-and-loss", title: "Profit & Loss", description: "P&L report." },
  { path: "/dashboard/reports/tally-export", title: "Tally Export", description: "Export to Tally." },
  { path: "/dashboard/reports/gstr-1", title: "GSTR-1", description: "GSTR-1 return." },
  { path: "/dashboard/reports/gstr-3b", title: "GSTR-3B", description: "GSTR-3B return." },
  { path: "/dashboard/reports/gstr-2b-reconciliation", title: "GSTR-2B Recon", description: "GSTR-2B reconciliation." },
]

export function pageMapForPrompt(): string {
  return ADMIN_PAGES.map((p) => `- ${p.path} — ${p.title}: ${p.description}`).join("\n")
}
