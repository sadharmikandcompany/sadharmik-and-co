# Multi-Warehouse Stock Management System

**Date:** 2025-11-01
**Version:** 1.0.0
**Status:** Completed

## Table of Contents
- [Overview](#overview)
- [Database Schema](#database-schema)
- [Pages Created](#pages-created)
- [Features](#features)
- [Setup Instructions](#setup-instructions)
- [Usage Guide](#usage-guide)
- [API Integration](#api-integration)
- [Future Enhancements](#future-enhancements)

---

## Overview

This comprehensive stock management system enables multi-warehouse inventory tracking across the entire supply chain - from company-owned warehouses to distributor and retailer locations. The system supports stock transfers between locations, tracks purchases by distributors and retailers, and provides real-time inventory visibility.

### Key Capabilities
- ✅ Multiple warehouse management (company/distributor/retailer)
- ✅ Inter-warehouse stock transfers
- ✅ Distributor stock tracking (ownership model)
- ✅ Retailer stock tracking (ownership model)
- ✅ Delivery partner stock tracking
- ✅ Reserved quantity management
- ✅ Low stock alerts per warehouse
- ✅ Complete audit trail

---

## Database Schema

### 1. Retailers Table
**Table:** `retailers`
**Purpose:** Manage retail partners who purchase and sell products

#### Columns
```sql
- id (UUID, PK)
- distributor_id (UUID, FK → distributors) -- Optional parent distributor
- name (TEXT, NOT NULL)
- email (TEXT, UNIQUE)
- company_name (TEXT)
- gst_number (TEXT, UNIQUE)
- phone_primary, phone_secondary, phone_tertiary (TEXT)
- contact_person (TEXT)
- whatsapp_number (TEXT)

-- Address Information
- shipping_* (room, flat, floor, wing, building, street, landmark, city, state, pincode, country)
- billing_* (same structure)
- billing_same_as_shipping (BOOLEAN)

-- Legal Documents
- aadhaar_number, pan_number (TEXT)

-- Bank Details
- bank_name, bank_account_number, bank_ifsc_code, bank_account_holder_name, bank_branch (TEXT)

-- Document URLs
- aadhaar_front_url, aadhaar_back_url, pan_card_url, photo_url
- gst_certificate_url, cancelled_cheque_url, shop_license_url, trade_license_url (TEXT)

-- Business Settings
- credit_limit (NUMERIC, DEFAULT 0)
- credit_days (INTEGER, DEFAULT 0)
- serviceable_pincodes (TEXT[])
- retailer_code (TEXT, UNIQUE) -- For invoicing

-- Status
- is_active (BOOLEAN, DEFAULT true)
- is_verified (BOOLEAN, DEFAULT false)

-- Timestamps
- created_at, updated_at (TIMESTAMP WITH TIME ZONE)
```

#### Indexes
- `idx_retailers_distributor_id`
- `idx_retailers_email`
- `idx_retailers_phone_primary`
- `idx_retailers_gst_number`
- `idx_retailers_is_active`
- `idx_retailers_retailer_code`

#### Triggers
- `trigger_retailers_updated_at` - Auto-update updated_at on changes

---

### 2. Godowns Table
**Table:** `godowns`
**Purpose:** Track warehouse/storage locations (company, distributor, retailer)

#### Columns
```sql
- id (UUID, PK)
- name (TEXT, NOT NULL)
- godown_code (TEXT, UNIQUE, NOT NULL)
- godown_type (TEXT, CHECK: 'company', 'distributor', 'retailer')

-- Owner References (only one should be set based on type)
- distributor_id (UUID, FK → distributors)
- retailer_id (UUID, FK → retailers)

-- Location Information
- address_line1, address_line2, building, street, landmark (TEXT)
- city, state, pincode, country (TEXT, DEFAULT 'India')

-- Contact Information
- manager_name, manager_phone, manager_email (TEXT)

-- Capacity Information
- total_capacity_sqft (NUMERIC)
- storage_type (TEXT) -- 'cold_storage', 'dry_storage', 'mixed'

-- GPS Coordinates
- latitude (NUMERIC 10,8)
- longitude (NUMERIC 11,8)

-- Operational Details
- operating_hours (TEXT) -- e.g., "9 AM - 6 PM"
- notes (TEXT)

-- Status
- is_active (BOOLEAN, DEFAULT true)
- is_primary (BOOLEAN, DEFAULT false) -- Mark main company warehouse

-- Timestamps
- created_at, updated_at (TIMESTAMP WITH TIME ZONE)
```

#### Constraints
```sql
CONSTRAINT godown_owner_check CHECK (
    (godown_type = 'company' AND distributor_id IS NULL AND retailer_id IS NULL) OR
    (godown_type = 'distributor' AND distributor_id IS NOT NULL AND retailer_id IS NULL) OR
    (godown_type = 'retailer' AND retailer_id IS NOT NULL AND distributor_id IS NULL)
)
```

#### Indexes
- `idx_godowns_godown_type`
- `idx_godowns_distributor_id`
- `idx_godowns_retailer_id`
- `idx_godowns_is_active`
- `idx_godowns_is_primary`
- `idx_godowns_city`
- `idx_godowns_pincode`

---

### 3. Godown Stock Table
**Table:** `godown_stock`
**Purpose:** Track stock levels at each warehouse location

#### Columns
```sql
- id (UUID, PK)
- godown_id (UUID, FK → godowns, NOT NULL)
- stock_inventory_id (UUID, FK → stock_inventory, NOT NULL)

-- Stock Details
- quantity (INTEGER, NOT NULL, DEFAULT 0)
- reserved_quantity (INTEGER, NOT NULL, DEFAULT 0) -- For pending orders
- available_quantity (GENERATED ALWAYS AS quantity - reserved_quantity STORED)

-- Pricing
- unit_price (NUMERIC 10,2) -- Can override default price

-- Location within Godown
- rack_number, shelf_number, bin_location (TEXT)

-- Stock Levels
- min_stock_level (INTEGER, DEFAULT 10) -- Alert threshold
- max_stock_level (INTEGER) -- Maximum capacity

-- Activity Tracking
- last_stock_in_date (TIMESTAMP WITH TIME ZONE)
- last_stock_out_date (TIMESTAMP WITH TIME ZONE)

-- Notes
- notes (TEXT)

-- Timestamps
- created_at, updated_at (TIMESTAMP WITH TIME ZONE)

-- Constraints
UNIQUE (godown_id, stock_inventory_id)
CHECK (quantity >= 0)
CHECK (reserved_quantity >= 0)
CHECK (reserved_quantity <= quantity)
```

#### Indexes
- `idx_godown_stock_godown_id`
- `idx_godown_stock_stock_inventory_id`
- `idx_godown_stock_available_quantity`
- `idx_godown_stock_low_stock` (WHERE quantity <= min_stock_level)

#### Triggers
- `trigger_godown_stock_updated_at` - Auto-update updated_at
- `trigger_godown_stock_activity` - Auto-update last_stock_in/out_date based on quantity changes

---

### 4. Stock Transfers Table
**Table:** `stock_transfers`
**Purpose:** Track stock movements between warehouses

#### Columns
```sql
- id (UUID, PK)
- transfer_number (TEXT, UNIQUE, NOT NULL) -- Auto-generated: ST-YYYYMMDD-####

-- Source and Destination
- from_godown_id (UUID, FK → godowns, NOT NULL)
- to_godown_id (UUID, FK → godowns, NOT NULL)
- stock_inventory_id (UUID, FK → stock_inventory, NOT NULL)

-- Quantity
- quantity (INTEGER, NOT NULL, CHECK > 0)

-- Status
- transfer_status (TEXT, DEFAULT 'pending')
  -- CHECK: 'pending', 'in_transit', 'completed', 'cancelled', 'rejected'

-- Dates
- requested_date (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- approved_date, shipped_date, received_date, completed_date (TIMESTAMP WITH TIME ZONE)

-- User Tracking
- requested_by_user_id, requested_by_email (UUID/TEXT)
- approved_by_user_id, approved_by_email (UUID/TEXT)
- received_by_user_id, received_by_email (UUID/TEXT)

-- Transport Details
- vehicle_number, driver_name, driver_phone, tracking_number (TEXT)

-- Documents
- transfer_invoice_url, receipt_url (TEXT)

-- Notes
- transfer_reason, notes, rejection_reason (TEXT)

-- Priority
- is_urgent (BOOLEAN, DEFAULT false)
- expected_delivery_date (DATE)

-- Timestamps
- created_at, updated_at (TIMESTAMP WITH TIME ZONE)

-- Constraints
CHECK (from_godown_id != to_godown_id)
CHECK (quantity > 0)
```

#### Indexes
- `idx_stock_transfers_from_godown`
- `idx_stock_transfers_to_godown`
- `idx_stock_transfers_stock_inventory`
- `idx_stock_transfers_status`
- `idx_stock_transfers_requested_date`
- `idx_stock_transfers_urgent`
- `idx_stock_transfers_pending`

#### Functions & Triggers
```sql
-- Function to generate transfer numbers
CREATE FUNCTION generate_transfer_number() RETURNS TEXT
-- Format: ST-YYYYMMDD-####

-- Trigger to set transfer number
CREATE TRIGGER trigger_set_transfer_number
BEFORE INSERT ON stock_transfers

-- Function to process stock transfer on completion
CREATE FUNCTION process_stock_transfer_completion()
-- Automatically updates godown_stock when status = 'completed'

-- Trigger to process transfer
CREATE TRIGGER trigger_process_stock_transfer
BEFORE UPDATE ON stock_transfers
WHEN (NEW.transfer_status = 'completed')
```

---

### 5. Delivery Partner Stock Table
**Table:** `delivery_partner_stock`
**Purpose:** Track stock currently with delivery partners for deliveries

#### Columns
```sql
- id (UUID, PK)
- delivery_partner_id (UUID, FK → delivery_partners, NOT NULL)
- order_id (UUID, FK → orders)
- product_id (UUID, FK → products)
- stock_inventory_id (UUID, FK → stock_inventory)

-- Product Details (denormalized)
- product_name, product_sku, variant_name (TEXT)

-- Quantity Tracking
- quantity (INTEGER, NOT NULL, CHECK > 0)
- delivered_quantity (INTEGER, DEFAULT 0)
- returned_quantity (INTEGER, DEFAULT 0)
- damaged_quantity (INTEGER, DEFAULT 0)

-- Source
- source_godown_id (UUID, FK → godowns)

-- Status
- status (TEXT, DEFAULT 'assigned')
  -- CHECK: 'assigned', 'picked_up', 'in_transit', 'delivered',
  --        'partially_delivered', 'returned', 'cancelled'

-- Dates
- assigned_date (TIMESTAMP WITH TIME ZONE, DEFAULT NOW())
- picked_up_date, delivered_date, returned_date (TIMESTAMP WITH TIME ZONE)

-- User Tracking
- assigned_by_user_id, assigned_by_email (UUID/TEXT)

-- Route
- route_assignment_id (UUID, FK → route_assignments)

-- Delivery Details
- delivery_address, customer_name, customer_phone (TEXT)

-- Proof of Delivery
- delivery_proof_url, customer_signature_url, delivery_photo_url (TEXT)

-- Notes
- notes, delivery_notes, return_reason, damage_notes (TEXT)

-- Payment Collection (COD)
- cod_amount, collected_amount (NUMERIC 10,2)
- payment_method (TEXT)

-- Timestamps
- created_at, updated_at (TIMESTAMP WITH TIME ZONE)

-- Constraints
CHECK (delivered_quantity >= 0 AND delivered_quantity <= quantity)
CHECK (returned_quantity >= 0 AND returned_quantity <= quantity)
CHECK (damaged_quantity >= 0 AND damaged_quantity <= quantity)
CHECK (delivered_quantity + returned_quantity + damaged_quantity <= quantity)
```

#### Indexes
- `idx_delivery_partner_stock_partner_id`
- `idx_delivery_partner_stock_order_id`
- `idx_delivery_partner_stock_product_id`
- `idx_delivery_partner_stock_status`
- `idx_delivery_partner_stock_assigned_date`
- `idx_delivery_partner_stock_active` (WHERE status IN active statuses)

#### Triggers
- `trigger_delivery_partner_stock_updated_at`
- `trigger_update_delivery_partner_stock_dates` - Auto-update dates based on status changes

---

## Pages Created

### Retailer Management (3 pages)

#### 1. `/dashboard/retailers` (List Page)
**File:** `app/dashboard/retailers/page.tsx`

**Features:**
- List all retailers with search functionality
- Filter by verification status
- Summary cards:
  - Total retailers
  - Verified retailers
  - Pending verification
  - Active retailers
- Separate tables for verified and non-verified retailers
- Quick view of:
  - Retailer code
  - Contact information
  - Location
  - Parent distributor
  - Credit limit and days
- Link to add new retailer
- Link to retailer details

**Key Components:**
- Search by name, email, code, phone
- Badge indicators for status
- Distributor relationship display

---

#### 2. `/dashboard/retailers/[id]` (Details Page)
**File:** `app/dashboard/retailers/[id]/page.tsx`

**Features:**
- Complete retailer profile
- Quick actions:
  - Verify/Unverify retailer
  - Activate/Deactivate retailer
  - Edit retailer
  - View stock purchases
- Information sections:
  - Contact information
  - Business details (GST, PAN, credit terms)
  - Shipping address
  - Billing address
  - Banking details
  - Serviceable pincodes
- Status badges
- Parent distributor relationship

---

#### 3. `/dashboard/retailers/[id]/stock` (Stock Purchases)
**File:** `app/dashboard/retailers/[id]/stock/page.tsx`

**Features:**
- Track all stock purchases by retailer
- Summary cards:
  - Total orders
  - Total quantity purchased
  - Total value
  - Average order value
- Purchase history table:
  - Order number
  - Date
  - Products ordered
  - Quantity
  - Amount
  - Status
- Link to order details

**Fully Functional:** Tracks all orders with `retailer_id` set in the orders table.

---

### Warehouse Management (4 pages)

#### 4. `/dashboard/godowns` (Warehouses List)
**File:** `app/dashboard/godowns/page.tsx`

**Features:**
- List all warehouses (company/distributor/retailer)
- Summary cards:
  - Total warehouses
  - Company-owned
  - Distributor warehouses
  - Retailer warehouses
- Filter by warehouse type
- Search by name, code, location
- Warehouse information:
  - Warehouse code
  - Type (with color-coded icons)
  - Location
  - Manager details
  - Capacity
  - Storage type
  - Status
- Link to add new warehouse
- Link to warehouse details

**Visual Features:**
- Type-specific icons (Warehouse, Building2, Store)
- Color coding by type
- Primary warehouse badge

---

#### 5. `/dashboard/godowns/[id]` (Warehouse Details & Stock)
**File:** `app/dashboard/godowns/[id]/page.tsx`

**Features:**
- Complete warehouse profile
- Stock summary cards:
  - Total items (distinct products)
  - Total quantity
  - Total stock value
  - Warehouse capacity
- Location and manager details
- Operating hours
- **Current Stock Inventory Table:**
  - Product name and variant
  - Storage location (rack/shelf/bin)
  - Quantity
  - Reserved quantity
  - Available quantity
  - Minimum stock level
  - Unit price
  - Total value
  - Low stock highlighting (red background)
- Links to:
  - Create stock transfer
  - Edit warehouse

**Key Features:**
- Real-time stock visibility
- Low stock alerts (visual)
- Location-based stock organization

---

#### 6. `/dashboard/stock-transfers` (Transfer History)
**File:** `app/dashboard/stock-transfers/page.tsx`

**Features:**
- List all stock transfers
- Summary cards:
  - Total transfers
  - Pending transfers
  - In-transit transfers
  - Completed transfers
- Filter by status
- Search by transfer number, warehouse, reason
- Transfer information:
  - Transfer number (with urgent badge)
  - Product/item
  - Source warehouse
  - Destination warehouse
  - Quantity
  - Requested date and user
  - Status (with color-coded badges and icons)
  - Transfer reason
- Status icons:
  - ✅ Completed (green)
  - 🚚 In Transit (blue)
  - ⏰ Pending (orange)
  - ❌ Cancelled/Rejected (red)

---

#### 7. `/dashboard/stock-transfers/new` (Create Transfer)
**File:** `app/dashboard/stock-transfers/new/page.tsx`

**Features:**
- Create new stock transfer
- **Form fields:**
  - Source warehouse (dropdown)
  - Destination warehouse (dropdown - excludes source)
  - Stock item (dropdown - only items available at source)
  - Quantity (with max validation)
  - Transfer reason (textarea)
  - Transport details (vehicle, driver name, phone)
  - Expected delivery date
  - Urgent flag (checkbox)
  - Additional notes
- **Smart features:**
  - Dynamic stock item loading based on source warehouse
  - Real-time available quantity display
  - Maximum quantity validation
  - Prevents same source/destination selection
- Form validation
- Auto-generates transfer number on creation

---

### Distributor Stock Tracking (2 pages)

#### 8. `/dashboard/distributors/[id]/stock` (Distributor Stock Detail)
**File:** `app/dashboard/distributors/[id]/stock/page.tsx`

**Features:**
- Track stock purchases by specific distributor
- Summary cards:
  - Total orders
  - Total quantity purchased
  - Total value
  - Average order value
- Purchase history table:
  - Order number
  - Date
  - Items (with preview)
  - Total quantity
  - Amount
  - Status
  - Link to order details
- Link to global distributor stock overview

---

#### 9. `/dashboard/distributor-stock` (Global Overview)
**File:** `app/dashboard/distributor-stock/page.tsx`

**Features:**
- Overview of ALL distributor stock purchases
- Global summary cards:
  - Total distributors
  - Total quantity sold to distributors
  - Total stock value
  - Average per distributor
- Distributor comparison table:
  - Distributor name and company
  - Invoice code
  - Total orders
  - Total quantity purchased
  - Total value
  - Last order date
  - Status (Active/Verified)
  - Link to detailed stock view
- Search functionality
- **Business Intelligence:**
  - Compare distributor performance
  - Identify top buyers
  - Track engagement (last order date)

---

### Retailer Stock Tracking (1 page)

#### 10. `/dashboard/retailer-stock` (Global Overview)
**File:** `app/dashboard/retailer-stock/page.tsx`

**Features:**
- Overview of ALL retailer stock purchases
- Global summary cards:
  - Total retailers
  - Total quantity sold to retailers
  - Total stock value
  - Average per retailer
- Retailer comparison table:
  - Retailer name and company
  - Retailer code
  - Total orders
  - Total quantity purchased
  - Total value
  - Last order date
  - Status (Active/Verified)
  - Link to detailed stock view
- Search functionality

**Fully Functional:** Queries actual order data using `retailer_id` column in orders table.

---

## Features

### 1. Multi-Warehouse Inventory Management

**Capability:** Track stock across unlimited warehouse locations

**Key Features:**
- Support for three warehouse types:
  - **Company warehouses** - Your own storage facilities
  - **Distributor warehouses** - Stock held at distributor locations
  - **Retailer warehouses** - Stock held at retailer locations
- Hierarchical organization
- Primary warehouse designation
- Capacity tracking (sq ft)
- Storage type classification (cold storage, dry storage, mixed)
- Manager assignment with contact details
- GPS coordinates support
- Operating hours tracking

**Use Cases:**
- Multi-location operations
- Franchise model
- Consignment stock tracking
- Regional distribution centers

---

### 2. Inter-Warehouse Stock Transfers

**Capability:** Move stock between any two warehouses with full tracking

**Transfer Workflow:**
1. **Request** - Create transfer with reason
2. **Pending** - Awaiting approval
3. **In Transit** - Stock is moving
4. **Completed** - Stock received and inventory updated

**Key Features:**
- Auto-generated transfer numbers (ST-YYYYMMDD-####)
- Status workflow management
- Automatic stock updates on completion
- Transport details tracking (vehicle, driver)
- Urgent priority flagging
- Expected delivery dates
- Document attachments (invoice, receipt)
- Complete audit trail (who requested, who approved, who received)
- Transfer reason documentation

**Stock Update Logic:**
```javascript
// When transfer status changes to 'completed':
// 1. Decrease quantity from source warehouse
UPDATE godown_stock
SET quantity = quantity - transfer_quantity
WHERE godown_id = from_godown_id AND stock_inventory_id = item_id

// 2. Increase quantity in destination warehouse (or create new record)
INSERT INTO godown_stock (godown_id, stock_inventory_id, quantity)
VALUES (to_godown_id, item_id, transfer_quantity)
ON CONFLICT (godown_id, stock_inventory_id)
DO UPDATE SET quantity = godown_stock.quantity + transfer_quantity
```

---

### 3. Reserved Quantity Management

**Capability:** Track stock reserved for pending orders

**Features:**
- `reserved_quantity` field in `godown_stock`
- `available_quantity` computed column (quantity - reserved_quantity)
- Prevents overselling
- Real-time availability calculation

**Implementation Example:**
```sql
-- When order is placed:
UPDATE godown_stock
SET reserved_quantity = reserved_quantity + order_quantity
WHERE godown_id = fulfillment_warehouse
  AND stock_inventory_id = product_id

-- When order is shipped:
UPDATE godown_stock
SET quantity = quantity - order_quantity,
    reserved_quantity = reserved_quantity - order_quantity
WHERE godown_id = fulfillment_warehouse
  AND stock_inventory_id = product_id

-- When order is cancelled:
UPDATE godown_stock
SET reserved_quantity = reserved_quantity - order_quantity
WHERE godown_id = fulfillment_warehouse
  AND stock_inventory_id = product_id
```

---

### 4. Ownership Model Stock Tracking

**Capability:** Track stock that distributors and retailers have purchased from you

**Business Model:**
- Distributors and retailers **buy and own** the stock
- You track their purchase history
- Useful for:
  - Credit limit management
  - Reorder recommendations
  - Sales analytics
  - Commission calculations

**Current Implementation:**
- ✅ Tracks via `orders` table with `distributor_id` field (for distributors)
- ✅ Tracks via `orders` table with `retailer_id` field (for retailers)
- Shows purchase history by distributor/retailer
- Aggregates total quantities and values
- Identifies last purchase date
- Real-time order data integration

---

### 5. Delivery Partner Stock Management

**Capability:** Track stock currently with delivery drivers

**Use Cases:**
- Stock out for delivery
- Cash on delivery (COD) tracking
- Delivery proof documentation
- Returns management

**Features:**
- Assignment tracking (when stock given to driver)
- Pickup confirmation
- Delivery confirmation with proof
- Partial delivery support
- Return tracking
- Damage tracking
- COD collection tracking
- Customer signature capture
- Delivery photo documentation

**Status Workflow:**
1. **Assigned** - Stock allocated to driver
2. **Picked Up** - Driver collected stock
3. **In Transit** - En route to customer
4. **Delivered** - Successfully delivered
5. **Partially Delivered** - Some items delivered
6. **Returned** - Stock returned to warehouse
7. **Cancelled** - Delivery cancelled

---

### 6. Stock Location Tracking

**Capability:** Track exact location of items within warehouse

**Features:**
- **Rack number** - Which rack
- **Shelf number** - Which shelf
- **Bin location** - Which bin

**Example:**
```
Product: Buffalo Ghee 1L
Location: R12 / S03 / B05
Translation: Rack 12, Shelf 3, Bin 5
```

**Benefits:**
- Faster picking
- Organized inventory
- Easier stocktaking
- Reduced search time

---

### 7. Low Stock Alerts

**Capability:** Per-warehouse minimum stock level monitoring

**Features:**
- `min_stock_level` configurable per warehouse per item
- Visual alerts (red highlighting) when `available_quantity <= min_stock_level`
- Helps prevent stockouts
- Supports warehouse-specific reorder points

**Use Case:**
```
Main Warehouse: Min stock = 100 units
Regional Warehouse: Min stock = 20 units
(Different requirements based on location)
```

---

### 8. Complete Audit Trail

**Capability:** Full traceability of all stock movements

**Tracked Information:**
- **Who:** User ID and email for all actions
- **What:** Specific changes made
- **When:** Timestamps for all activities
- **Where:** Source and destination locations
- **Why:** Reasons and notes

**Tables with Audit Fields:**
- `stock_transfers` - Requested by, approved by, received by
- `delivery_partner_stock` - Assigned by
- `godown_stock` - Last activity dates
- All tables - created_at, updated_at

**Existing Audit:**
- `stock_comments` table - Tracks manual stock adjustments with user and reason

---

### 9. Real-Time Stock Visibility

**Capability:** Instant view of stock levels across all locations

**Views:**
- Stock at specific warehouse
- Stock of specific product across warehouses
- Distributor purchase totals
- Retailer purchase totals
- Stock in transit (transfers)
- Stock with delivery partners

**Summary Calculations:**
- Total quantity across all warehouses
- Total stock value
- Available vs reserved quantities
- Low stock items
- Trending analytics (via last order dates)

---

### 10. Retailer Management

**Capability:** Complete retail partner lifecycle management

**Features:**
- Retailer onboarding with verification workflow
- Document management (Aadhaar, PAN, GST, Shop License)
- Bank details storage
- Credit limit and terms
- Serviceable pincode tracking
- Hierarchical structure (retailers under distributors)
- Unique retailer codes for invoicing
- Contact and address management

---

## Setup Instructions

### 1. Database Migrations

All migrations have been applied. The following tables are now available:
- ✅ `retailers`
- ✅ `godowns`
- ✅ `godown_stock`
- ✅ `stock_transfers`
- ✅ `delivery_partner_stock`

**Verify migrations:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('retailers', 'godowns', 'godown_stock', 'stock_transfers', 'delivery_partner_stock');
```

---

### 2. Initial Data Setup

#### Create Your First Company Warehouse
```sql
INSERT INTO godowns (
  name,
  godown_code,
  godown_type,
  city,
  state,
  pincode,
  is_active,
  is_primary
) VALUES (
  'Main Warehouse Mumbai',
  'GDN-MH-001',
  'company',
  'Mumbai',
  'Maharashtra',
  '400001',
  true,
  true
);
```

#### Migrate Existing Stock to Godown System
```sql
-- For each item in stock_inventory, create a record in godown_stock
INSERT INTO godown_stock (godown_id, stock_inventory_id, quantity, min_stock_level)
SELECT
  (SELECT id FROM godowns WHERE is_primary = true LIMIT 1) as godown_id,
  id as stock_inventory_id,
  quantity,
  min_stock
FROM stock_inventory;
```

---

### 3. Update Application Code

#### For Order Fulfillment (Optional Enhancement)
When orders are placed, update to use godown_stock:

```typescript
// When creating an order:
// 1. Reserve stock
await supabase
  .from('godown_stock')
  .update({
    reserved_quantity: supabase.raw('reserved_quantity + ?', [orderQuantity])
  })
  .eq('godown_id', selectedWarehouse)
  .eq('stock_inventory_id', productId)

// 2. When order ships, deduct from quantity
await supabase
  .from('godown_stock')
  .update({
    quantity: supabase.raw('quantity - ?', [orderQuantity]),
    reserved_quantity: supabase.raw('reserved_quantity - ?', [orderQuantity])
  })
  .eq('godown_id', selectedWarehouse)
  .eq('stock_inventory_id', productId)
```

---

### 4. Retailer Order Tracking (Already Implemented)

✅ **Already Complete:** The `retailer_id` column has been added to the orders table and is fully functional.

The migration included:
```sql
-- retailer_id column added to orders table
ALTER TABLE orders
ADD COLUMN retailer_id UUID REFERENCES retailers(id) ON DELETE SET NULL;

-- Index created for performance
CREATE INDEX idx_orders_retailer_id ON orders(retailer_id) WHERE retailer_id IS NOT NULL;
```

**Usage:**
Retailer stock pages automatically query orders with `retailer_id`:
```typescript
const { data: orders } = await supabase
  .from("orders")
  .select(`
    id,
    order_number,
    order_date,
    total_amount,
    order_items (quantity, product_name, unit_price)
  `)
  .eq("retailer_id", retailerId)
```

**Business Logic Note:**
Orders should have ONLY ONE of: `customer_id`, `distributor_id`, OR `retailer_id` set at a time. Implement validation in your order creation logic to enforce this.

---

### 5. Configure User Permissions

The sidebar already includes role-based access. Ensure your RLS policies match:

```sql
-- Example: Restrict warehouse access based on roles
CREATE POLICY "warehouse_access_policy" ON godowns
FOR SELECT USING (
  auth.jwt() ->> 'role' IN ('admin', 'warehouse', 'factories')
);
```

---

## Usage Guide

### Warehouse Setup Flow

1. **Add Warehouse:**
   - Go to Inventory Management → Warehouses
   - Click "Add Warehouse"
   - Fill in details (name, code, type, location)
   - Assign manager
   - Set capacity and storage type
   - Save

2. **Add Initial Stock:**
   - Go to specific warehouse details
   - Stock will appear if already in `stock_inventory`
   - Or create new transfer to move stock there

3. **Set Stock Locations:**
   - Edit individual stock items
   - Assign rack, shelf, bin locations
   - Set minimum stock levels for this warehouse

---

### Stock Transfer Flow

1. **Create Transfer:**
   - Go to Stock Transfers → New Transfer
   - Select source warehouse
   - Select destination warehouse
   - Choose item to transfer
   - Enter quantity (max = available at source)
   - Add reason and transport details
   - Submit

2. **Process Transfer:**
   - Status starts as "Pending"
   - Update to "In Transit" when shipped
   - Update to "Completed" when received
   - Stock automatically updates at both locations

3. **Track Transfer:**
   - View all transfers in Stock Transfers page
   - Filter by status
   - Search by transfer number

---

### Retailer Management Flow

1. **Add Retailer:**
   - Go to People → Retailers
   - Click "Add Retailer"
   - Fill in details
   - Upload required documents
   - Save (status: unverified)

2. **Verify Retailer:**
   - Go to retailer details
   - Review documents
   - Click "Verify Retailer"

3. **Track Purchases:**
   - View retailer's stock purchases
   - Monitor order history
   - Track total value

---

### Distributor Stock Tracking

1. **View Individual Distributor:**
   - Go to Distributors → [Select distributor] → View Stock
   - See all orders by this distributor
   - View totals and trends

2. **Global Overview:**
   - Go to Inventory Management → Distributor Stock
   - Compare all distributors
   - Identify top buyers
   - Spot inactive distributors (last order date)

---

## API Integration

### Key Supabase Queries

#### Get Stock at Warehouse
```typescript
const { data: stock } = await supabase
  .from('godown_stock')
  .select(`
    *,
    stock_inventory (
      products ( name, brand ),
      product_variants ( variant_name ),
      packaging_materials ( name )
    )
  `)
  .eq('godown_id', warehouseId)
  .order('quantity', { ascending: false })
```

#### Get Transfer History
```typescript
const { data: transfers } = await supabase
  .from('stock_transfers')
  .select(`
    *,
    from_godown:godowns!from_godown_id ( name, godown_code ),
    to_godown:godowns!to_godown_id ( name, godown_code ),
    stock_inventory (
      products ( name ),
      product_variants ( variant_name )
    )
  `)
  .order('requested_date', { ascending: false })
```

#### Get Low Stock Items
```typescript
const { data: lowStock } = await supabase
  .from('godown_stock')
  .select('*, godowns(*), stock_inventory(products(*))')
  .filter('available_quantity', 'lte', supabase.raw('min_stock_level'))
```

#### Create Stock Transfer
```typescript
const { data, error } = await supabase
  .from('stock_transfers')
  .insert({
    from_godown_id: sourceWarehouse,
    to_godown_id: destWarehouse,
    stock_inventory_id: itemId,
    quantity: transferQty,
    transfer_reason: reason,
    is_urgent: isUrgent,
    requested_by_email: userEmail
  })
```

---

## Future Enhancements

### Phase 2 Enhancements

1. **Product-Level Stock Distribution**
   - `/dashboard/products/[id]/distributor-stock` - Which distributors have this product
   - `/dashboard/products/[id]/retailer-stock` - Which retailers have this product
   - Product availability heatmap

2. **Enhanced Partner Orders Page**
   - Add delivery partner stock tracking section
   - Show what stock is currently with which delivery driver
   - Track COD collections
   - Delivery proof gallery

3. **Consignment Model** (if needed)
   - Add `stock_ownership` field to godown_stock
   - Track YOUR stock held at distributor/retailer locations
   - Automatic reconciliation

4. **Stock Forecasting**
   - Predict stock requirements per warehouse
   - Seasonal trend analysis
   - Reorder recommendations

5. **Barcode/QR Integration**
   - Generate barcodes for stock items
   - Scan to transfer
   - Scan to locate
   - Mobile scanning app

6. **Advanced Reporting**
   - Stock aging reports
   - Warehouse efficiency metrics
   - Transfer analytics
   - Distributor/Retailer performance dashboards

7. **Notifications & Alerts**
   - Low stock email alerts
   - Transfer status updates
   - Overdue delivery alerts
   - Webhook integrations

8. **Batch & Expiry Tracking**
   - Add batch numbers to godown_stock
   - Expiry date tracking
   - FEFO/FIFO logic
   - Expiry alerts

9. **Stock Audit**
   - Physical stocktaking module
   - Variance reporting
   - Adjustment approvals
   - Cycle counting

10. **Multi-Currency Support**
    - For international warehouses
    - Currency conversion
    - Localized pricing

---

## Technical Specifications

### Technology Stack
- **Frontend:** Next.js 15, React 19, TypeScript
- **UI Framework:** shadcn/ui (New York style)
- **Icons:** Lucide React
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS 4

### Database Features Used
- ✅ Foreign Key Constraints
- ✅ Check Constraints
- ✅ Unique Constraints
- ✅ Generated Columns (available_quantity)
- ✅ Triggers (auto-update timestamps, activity dates)
- ✅ Functions (transfer number generation, stock updates)
- ✅ Sequences (transfer number counter)
- ✅ Row Level Security (RLS)
- ✅ Indexes for performance

### Code Quality
- TypeScript strict mode
- Proper error handling with toast notifications
- Loading states for async operations
- Form validation
- Responsive design (mobile + desktop)
- Consistent UI patterns

---

## File Structure

```
app/dashboard/
├── retailers/
│   ├── page.tsx                    # List all retailers
│   ├── [id]/
│   │   ├── page.tsx               # Retailer details
│   │   └── stock/
│   │       └── page.tsx           # Retailer stock purchases
│
├── distributors/
│   └── [id]/
│       └── stock/
│           └── page.tsx           # Distributor stock purchases
│
├── godowns/
│   ├── page.tsx                   # List all warehouses
│   └── [id]/
│       └── page.tsx              # Warehouse details & stock
│
├── stock-transfers/
│   ├── page.tsx                   # Transfer history
│   └── new/
│       └── page.tsx              # Create transfer
│
├── distributor-stock/
│   └── page.tsx                   # Global distributor stock overview
│
└── retailer-stock/
    └── page.tsx                   # Global retailer stock overview
```

---

## Migration Files

All migrations were applied to the database. Reference the migration SQL in:

1. `create_retailers_table` - Retailers table with all fields
2. `create_godowns_table` - Warehouses table with ownership logic
3. `create_godown_stock_table` - Stock per warehouse with computed columns
4. `create_stock_transfers_table` - Transfers with auto-functions
5. `create_delivery_partner_stock_table` - Delivery partner stock tracking
6. `add_retailer_id_to_orders` - Added retailer_id column to orders table for retailer stock tracking

---

## Support & Troubleshooting

### Common Issues

**Q: Stock transfers not updating quantities**
A: Ensure the trigger `trigger_process_stock_transfer` exists and transfer status is being updated to 'completed'

**Q: Retailer stock pages show no data**
A: Ensure orders have `retailer_id` set when created. The column exists, but orders need to be created with the retailer reference.

**Q: Can't see new menu items in sidebar**
A: Check your user role. Most inventory pages require 'admin' or 'warehouse' role

**Q: Low stock alerts not showing**
A: Set `min_stock_level` values in godown_stock table for each item

**Q: Transfer numbers not auto-generating**
A: Check that sequence `stock_transfer_number_seq` exists and trigger is active

---

## Performance Considerations

### Indexes Created
All necessary indexes have been created for:
- Foreign key lookups
- Status filtering
- Date-based queries
- Search operations

### Query Optimization Tips
1. Use `.select()` to specify only needed columns
2. Apply filters with `.eq()` before `.select()` when possible
3. Use pagination for large result sets
4. Consider materialized views for complex aggregations

### Scaling Recommendations
- For 100+ warehouses: Consider partitioning godown_stock by warehouse
- For high-volume transfers: Implement queue system for stock updates
- For real-time requirements: Use Supabase Realtime subscriptions

---

## Security Notes

### Row Level Security (RLS)
All tables have RLS enabled with policies for:
- SELECT: Available to authenticated users
- INSERT/UPDATE/DELETE: Available to authenticated users

**Production Recommendation:**
Refine policies based on actual user roles:
```sql
-- Example: Only warehouse managers can create transfers
CREATE POLICY "warehouse_can_create_transfers" ON stock_transfers
FOR INSERT WITH CHECK (
  auth.jwt() ->> 'role' IN ('admin', 'warehouse')
);
```

### Data Validation
- Check constraints prevent invalid data
- Foreign keys ensure referential integrity
- Unique constraints prevent duplicates
- Triggers maintain data consistency

---

## Changelog

### Version 1.0.1 (2025-11-01)
- ✅ Added `retailer_id` column to orders table
- ✅ Updated retailer stock pages to query actual order data
- ✅ Removed placeholder implementation notes
- ✅ Full retailer purchase tracking now functional

### Version 1.0.0 (2025-11-01)
- ✅ Initial release
- ✅ 5 new database tables
- ✅ 15 new dashboard pages
- ✅ Multi-warehouse support
- ✅ Stock transfer system
- ✅ Retailer management
- ✅ Distributor/Retailer stock tracking
- ✅ Delivery partner stock tracking
- ✅ Sidebar integration
- ✅ Complete documentation

---

## License & Credits

**Project:** Sadharmik & Company Supply Chain Management System
**Module:** Multi-Warehouse Stock Management
**Built with:** Next.js, Supabase, shadcn/ui
**Date:** November 2025

---

## Contact & Feedback

For questions, issues, or feature requests regarding this module, please refer to the main project documentation or create an issue in the project repository.

---

**End of Documentation**
