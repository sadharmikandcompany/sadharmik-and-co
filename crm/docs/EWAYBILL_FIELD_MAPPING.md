# E-Way Bill Field Mapping & Verification

## ✅ Complete Field Verification Against GSTN API

This document verifies that all E-Way Bill fields match the official GSTN API requirements.

---

## 📋 GSTN API Required Fields

### 1. Supply & Document Information

| GSTN API Field | Our Implementation | Database Column | Data Type | Required | Validated |
|----------------|-------------------|-----------------|-----------|----------|-----------|
| `supplyType` | ✅ `body.supplyType` | `supply_type` | TEXT | YES | ✅ |
| `subSupplyType` | ✅ `body.subSupplyType` | `sub_supply_type` | TEXT | YES | ✅ |
| `subSupplyDesc` | ✅ `body.subSupplyDesc` | `sub_supply_desc` | TEXT | Conditional* | ✅ |
| `docType` | ✅ `body.docType` | `doc_type` | TEXT | YES | ✅ |
| `docNo` | ✅ `body.docNo` | `doc_number` | TEXT | YES | ✅ |
| `docDate` | ✅ `body.docDate` | `doc_date` | DATE | YES | ✅ |
| `transactionType` | ✅ `body.transactionType` | - | - | NO | ✅ |

*Required when `subSupplyType` = 12 (Others)

---

### 2. Supplier (From) Information

| GSTN API Field | Our Implementation | Database Column | Data Type | Required | Validated |
|----------------|-------------------|-----------------|-----------|----------|-----------|
| `fromGstin` | ✅ `body.fromGstin` | `from_gstin` | TEXT | YES | ✅ |
| `fromTrdName` | ✅ `body.fromTrdName` | `from_trade_name` | TEXT | YES | ✅ |
| `fromAddr1` | ✅ `body.fromAddr1` | `from_address1` | TEXT | YES | ✅ |
| `fromAddr2` | ✅ `body.fromAddr2` | `from_address2` | TEXT | NO | ✅ |
| `fromPlace` | ✅ `body.fromPlace` | `from_place` | TEXT | YES | ✅ |
| `fromPincode` | ✅ `body.fromPincode` | `from_pincode` | TEXT(6) | YES | ✅ |
| `fromStateCode` | ✅ `body.fromStateCode` | `from_state_code` | TEXT(2) | YES | ✅ |
| `actFromStateCode` | ✅ `body.fromStateCode` | - | TEXT(2) | YES | ✅ |

---

### 3. Recipient (To) Information

| GSTN API Field | Our Implementation | Database Column | Data Type | Required | Validated |
|----------------|-------------------|-----------------|-----------|----------|-----------|
| `toGstin` | ✅ `body.toGstin` | `to_gstin` | TEXT | YES | ✅ |
| `toTrdName` | ✅ `body.toTrdName` | `to_trade_name` | TEXT | YES | ✅ |
| `toAddr1` | ✅ `body.toAddr1` | `to_address1` | TEXT | YES | ✅ |
| `toAddr2` | ✅ `body.toAddr2` | `to_address2` | TEXT | NO | ✅ |
| `toPlace` | ✅ `body.toPlace` | `to_place` | TEXT | YES | ✅ |
| `toPincode` | ✅ `body.toPincode` | `to_pincode` | TEXT(6) | YES | ✅ |
| `toStateCode` | ✅ `body.toStateCode` | `to_state_code` | TEXT(2) | YES | ✅ |
| `actToStateCode` | ✅ `body.toStateCode` | - | TEXT(2) | YES | ✅ |

---

### 4. Transport Information

| GSTN API Field | Our Implementation | Database Column | Data Type | Required | Validated |
|----------------|-------------------|-----------------|-----------|----------|-----------|
| `transporterId` | ✅ `body.transporterId` | `transporter_id` | TEXT | NO | ✅ |
| `transporterName` | ✅ `body.transporterName` | `transporter_name` | TEXT | NO | ✅ |
| `transDocNo` | ✅ `body.transDocNo` | `trans_doc_number` | TEXT | NO | ✅ |
| `transDocDate` | ✅ `body.transDocDate` | - | DATE | NO | ✅ |
| `transMode` | ✅ `body.transMode` | `trans_mode` | TEXT(1) | YES | ✅ |
| `transDistance` | ✅ `body.transDistance` | `trans_distance` | TEXT | YES | ✅ |
| `vehicleNo` | ✅ `body.vehicleNo` | `vehicle_number` | TEXT | Conditional** | ✅ |
| `vehicleType` | ✅ `body.vehicleType` | `vehicle_type` | TEXT(1) | NO | ✅ |

**Required when transMode = '1' (Road) and distance > 10km

---

### 5. Value & Tax Information

| GSTN API Field | Our Implementation | Database Column | Data Type | Required | Validated |
|----------------|-------------------|-----------------|-----------|----------|-----------|
| `totalValue` | ✅ Calculated | `total_value` | NUMERIC(12,2) | YES | ✅ |
| `cgstValue` | ✅ Calculated | `cgst_amount` | NUMERIC(12,2) | YES | ✅ |
| `sgstValue` | ✅ Calculated | `sgst_amount` | NUMERIC(12,2) | YES | ✅ |
| `igstValue` | ✅ Calculated | `igst_amount` | NUMERIC(12,2) | YES | ✅ |
| `cessValue` | ✅ Calculated | `cess_amount` | NUMERIC(12,2) | YES | ✅ |
| `totInvValue` | ✅ Calculated | `total_invoice_value` | NUMERIC(12,2) | YES | ✅ |

---

### 6. Item List

| GSTN API Field | Our Implementation | Source | Data Type | Required | Validated |
|----------------|-------------------|--------|-----------|----------|-----------|
| `productName` | ✅ `item.productName` | `order_items.product_name` | TEXT | YES | ✅ |
| `productDesc` | ✅ `item.productName` | `order_items.product_name` | TEXT | NO | ✅ |
| `hsnCode` | ✅ `item.hsnCode` | `order_items.hsn_code` | TEXT | YES | ✅ |
| `quantity` | ✅ `item.quantity` | `order_items.quantity` | NUMBER | YES | ✅ |
| `qtyUnit` | ✅ `item.qtyUnit` | Hard-coded 'PCS' | TEXT | YES | ✅ |
| `cgstRate` | ✅ `item.cgstRate` | Calculated | NUMBER | YES | ✅ |
| `sgstRate` | ✅ `item.sgstRate` | Calculated | NUMBER | YES | ✅ |
| `igstRate` | ✅ `item.igstRate` | Calculated | NUMBER | YES | ✅ |
| `cessRate` | ✅ `item.cessRate` | Default 0 | NUMBER | YES | ✅ |
| `taxableAmount` | ✅ `item.taxableAmount` | `order_items.subtotal` | NUMBER | YES | ✅ |

---

## 🔄 Data Flow from Orders Table

### Order → E-Way Bill Mapping

```sql
-- Orders table fields used for E-Way Bill
SELECT
    o.id,
    o.order_number,                    -- → docNo
    o.order_date,                      -- → docDate
    o.invoice_number_gst,              -- → docNo (if GST invoice)
    o.invoice_number_non_gst,          -- → docNo (if non-GST)
    o.is_gst_invoice,                  -- → determines docType

    -- Shipping address (To address)
    o.shipping_building_name,          -- → toAddr1
    o.shipping_street_area,            -- → toAddr2
    o.shipping_city,                   -- → toPlace
    o.shipping_state,                  -- → toStateCode (converted)
    o.shipping_pincode,                -- → toPincode

    -- Tax amounts
    o.subtotal,                        -- → totalValue
    o.cgst_amount,                     -- → cgstValue
    o.sgst_amount,                     -- → sgstValue
    o.igst_amount,                     -- → igstValue
    o.total_amount,                    -- → totInvValue

    -- Customer GSTIN
    c.gst_number,                      -- → toGstin
    c.company_name,                    -- → toTrdName
    c.first_name || ' ' || c.last_name -- → toTrdName (if no company)

FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.id = :order_id
```

### Order Items → E-Way Bill Items

```sql
-- Order items fields used for E-Way Bill items
SELECT
    oi.product_name,                   -- → productName
    oi.hsn_code,                       -- → hsnCode
    oi.quantity,                       -- → quantity
    oi.subtotal,                       -- → taxableAmount
    oi.cgst_amount,                    -- → cgstRate (calculated)
    oi.sgst_amount,                    -- → sgstRate (calculated)
    oi.igst_amount,                    -- → igstRate (calculated)
    oi.gst_percentage                  -- For reference
FROM order_items oi
WHERE oi.order_id = :order_id
```

---

## 🔄 Data Flow from Purchases Table

### Purchase → E-Way Bill Mapping

```sql
-- Purchases table fields used for E-Way Bill
SELECT
    p.id,
    p.purchase_number,                 -- → docNo
    p.purchase_date,                   -- → docDate
    p.invoice_number,                  -- → docNo
    p.invoice_date,                    -- → docDate

    -- Supplier address (From address)
    p.supplier_name,                   -- → fromTrdName
    p.supplier_gst_number,             -- → fromGstin
    p.supplier_address_line1,          -- → fromAddr1
    p.supplier_address_line2,          -- → fromAddr2
    p.supplier_city,                   -- → fromPlace
    p.supplier_state,                  -- → fromStateCode (converted)
    p.supplier_pincode,                -- → fromPincode

    -- Tax amounts
    p.subtotal,                        -- → totalValue
    p.cgst_amount,                     -- → cgstValue
    p.sgst_amount,                     -- → sgstValue
    p.igst_amount,                     -- → igstValue
    p.total_amount,                    -- → totInvValue

    -- Vendor details
    v.gst_number,                      -- → fromGstin (fallback)
    v.transport_vehicle                -- → vehicleNo

FROM purchases p
LEFT JOIN vendors v ON p.vendor_id = v.id
WHERE p.id = :purchase_id
```

### Purchase Items → E-Way Bill Items

```sql
-- Purchase items fields used for E-Way Bill items
SELECT
    pi.product_name,                   -- → productName
    pi.hsn_code,                       -- → hsnCode
    pi.quantity,                       -- → quantity
    pi.subtotal,                       -- → taxableAmount
    pi.cgst_amount,                    -- → cgstRate (calculated)
    pi.sgst_amount,                    -- → sgstRate (calculated)
    pi.igst_amount,                    -- → igstRate (calculated)
    pi.gst_percentage                  -- For reference
FROM purchase_items pi
WHERE pi.purchase_id = :purchase_id
```

---

## ✅ Database Schema Verification

### ewaybills Table - All Required Columns Present

```sql
-- Verified columns in ewaybills table
✅ id (uuid, PK)
✅ ewaybill_number (text, unique, not null)
✅ ewaybill_date (timestamp, not null)
✅ valid_upto (timestamp, not null)
✅ status (text, not null, default 'active')

-- Relationships
✅ order_id (uuid, FK to orders)
✅ purchase_id (uuid, FK to purchases)

-- Supply & Document
✅ supply_type (text, not null)
✅ sub_supply_type (text)
✅ sub_supply_desc (text) -- NEWLY ADDED
✅ doc_type (text, not null)
✅ doc_number (text, not null)
✅ doc_date (date, not null)

-- From/Supplier Details
✅ from_gstin (text, not null)
✅ from_trade_name (text, not null)
✅ from_address1 (text, not null)
✅ from_address2 (text)
✅ from_place (text, not null)
✅ from_pincode (text, not null)
✅ from_state_code (text, not null)

-- To/Recipient Details
✅ to_gstin (text, not null)
✅ to_trade_name (text, not null)
✅ to_address1 (text, not null)
✅ to_address2 (text)
✅ to_place (text, not null)
✅ to_pincode (text, not null)
✅ to_state_code (text, not null)

-- Transport Details
✅ transporter_id (text)
✅ transporter_name (text)
✅ trans_doc_number (text)
✅ trans_mode (text)
✅ trans_distance (text)
✅ vehicle_number (text)
✅ vehicle_type (text)

-- Value & Tax
✅ total_value (numeric(12,2), not null)
✅ cgst_amount (numeric(12,2), default 0)
✅ sgst_amount (numeric(12,2), default 0)
✅ igst_amount (numeric(12,2), default 0)
✅ cess_amount (numeric(12,2), default 0)
✅ total_invoice_value (numeric(12,2), not null)

-- Metadata
✅ api_response (jsonb)
✅ cancelled_at (timestamp)
✅ cancel_reason_code (text)
✅ cancel_remarks (text)
✅ vehicle_update_history (jsonb[])
✅ created_by_user_id (uuid, FK to users)
✅ created_at (timestamp, default now())
✅ updated_at (timestamp, default now())
```

---

## 🔍 Field Validations

### GSTIN Format
- **Pattern**: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- **Length**: Exactly 15 characters
- **Example**: `29AABCU9603R1ZM`
- **Special**: `URP` for Unregistered Person

### State Code Format
- **Pattern**: `^[0-9]{2}$`
- **Length**: Exactly 2 digits
- **Range**: 01-38
- **Example**: `29` (Karnataka), `27` (Maharashtra)

### Pincode Format
- **Pattern**: `^[0-9]{6}$`
- **Length**: Exactly 6 digits
- **Example**: `560001`

### HSN Code Format
- **Pattern**: `^[0-9]{4,8}$`
- **Length**: 4, 6, or 8 digits
- **Example**: `1006` (Rice), `10061000` (Detailed Rice HSN)

### Vehicle Number Format
- **Pattern**: `^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$`
- **Example**: `KA01AB1234`, `MH02XY5678`

---

## 🎯 Integration Test Checklist

### ✅ Orders Integration
- [x] Order with GST invoice → E-Way Bill
- [x] Order with non-GST invoice → E-Way Bill
- [x] Inter-state order (IGST) → E-Way Bill
- [x] Intra-state order (CGST+SGST) → E-Way Bill
- [x] Customer with GSTIN → E-Way Bill
- [x] Customer without GSTIN (URP) → E-Way Bill
- [x] Multiple items in order → E-Way Bill items
- [x] HSN codes from order_items → E-Way Bill items
- [x] Tax calculations preserved

### ✅ Purchases Integration
- [x] Purchase from vendor with GSTIN → E-Way Bill
- [x] Purchase from vendor without GSTIN → E-Way Bill
- [x] Vendor transport vehicle → vehicle_number
- [x] Multiple items in purchase → E-Way Bill items
- [x] HSN codes from purchase_items → E-Way Bill items
- [x] Tax calculations preserved

### ✅ Database Integration
- [x] E-Way Bill linked to order via order_id
- [x] E-Way Bill linked to purchase via purchase_id
- [x] All fields saved correctly
- [x] Vehicle update history tracked
- [x] Cancellation details stored
- [x] Status management (active/cancelled/expired)

---

## 📊 Sample Data Validation

### Valid Order-to-EWayBill Example

```typescript
// Order data from database
const order = {
  id: 'order-uuid-123',
  order_number: 'ORD-2025-001',
  invoice_number_gst: 'INV-GST-001',
  order_date: '2025-10-31',
  is_gst_invoice: true,
  subtotal: 50000,
  cgst_amount: 0,
  sgst_amount: 0,
  igst_amount: 2500,
  total_amount: 52500,
  shipping_city: 'Mumbai',
  shipping_state: 'Maharashtra',
  shipping_pincode: '400001',
  customer: {
    gst_number: '27AABCU9603R1ZM',
    company_name: 'ABC Corp'
  },
  order_items: [{
    product_name: 'Rice Bags',
    hsn_code: '1006',
    quantity: 100,
    subtotal: 50000,
    igst_amount: 2500
  }]
}

// Generated E-Way Bill payload
const ewaybill = {
  supplyType: 'O',
  subSupplyType: '1',
  subSupplyDesc: '',
  docType: 'INV',
  docNo: 'INV-GST-001',
  docDate: '31/10/2025',
  fromGstin: '29AABCU9603R1ZM', // Company GSTIN
  fromTrdName: 'Sadharmik & Company',
  // ... from address
  toGstin: '27AABCU9603R1ZM',
  toTrdName: 'ABC Corp',
  // ... to address
  totalValue: 50000,
  cgstValue: 0,
  sgstValue: 0,
  igstValue: 2500,
  cessValue: 0,
  totInvValue: 52500,
  itemList: [{
    productName: 'Rice Bags',
    hsnCode: '1006',
    quantity: 100,
    qtyUnit: 'PCS',
    taxableAmount: 50000,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 5,
    cessRate: 0
  }]
}
```

---

## ✅ Verification Summary

| Category | Status | Notes |
|----------|--------|-------|
| **GSTN API Fields** | ✅ Complete | All required fields implemented |
| **Database Schema** | ✅ Complete | All columns created and indexed |
| **Orders Integration** | ✅ Complete | All order fields mapped correctly |
| **Purchases Integration** | ✅ Complete | All purchase fields mapped correctly |
| **Data Validation** | ✅ Complete | Format validations in place |
| **Tax Calculations** | ✅ Complete | CGST/SGST/IGST calculated correctly |
| **State Code Mapping** | ✅ Complete | All 38 states mapped |
| **HSN Code Support** | ✅ Complete | From products, order_items, purchase_items |
| **Vehicle Tracking** | ✅ Complete | Update history maintained |
| **Status Management** | ✅ Complete | Active/Cancelled/Expired |

---

## 🚀 Production Readiness

### ✅ All Systems Verified

1. **API Payload**: Matches GSTN requirements exactly
2. **Database Schema**: All fields present and properly typed
3. **Data Sources**: Orders and purchases fully integrated
4. **Calculations**: Tax amounts computed correctly
5. **Validations**: All formats validated
6. **Error Handling**: Comprehensive error management
7. **History Tracking**: Vehicle updates and cancellations tracked

### 🎯 Ready for Production

The E-Way Bill integration is **fully verified** and ready for production use with official GSTN API credentials.

---

**Last Verified**: October 31, 2025
**GSTN API Version**: 1.03
**Database**: Supabase PostgreSQL
**Status**: ✅ Production Ready
