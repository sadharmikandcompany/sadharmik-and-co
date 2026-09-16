# E-Way Bill Integration Guide

This document provides a complete guide for setting up and using the E-Way Bill integration with the official GSTN API.

## Table of Contents

1. [Overview](#overview)
2. [Getting API Credentials](#getting-api-credentials)
3. [Environment Setup](#environment-setup)
4. [API Endpoints](#api-endpoints)
5. [Usage Guide](#usage-guide)
6. [Testing](#testing)
7. [Going to Production](#going-to-production)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The E-Way Bill system is mandatory under GST for movement of goods worth more than ₹50,000. This integration allows you to:

- ✅ Generate E-Way Bills
- ✅ Search/View E-Way Bill details
- ✅ Update vehicle details during transit
- ✅ Cancel E-Way Bills (within 24 hours)
- ✅ Extend validity
- ✅ Consolidate multiple E-Way Bills

### Key Features

- **Direct GSTN Integration**: No intermediary GSP required
- **Secure Authentication**: Token-based authentication with encryption
- **Real-time Validation**: Instant validation of GSTIN, HSN codes, etc.
- **Automatic Calculations**: Tax amounts calculated automatically
- **User-friendly UI**: Complete web interface for all operations

---

## Getting API Credentials

### Step 1: Register on E-Way Bill Portal

1. Visit the official E-Way Bill portal: https://ewaybillgst.gov.in/
2. Click on "Registration" and complete the process
3. Use your GSTIN and other business details

### Step 2: Create API User

1. Login to E-Way Bill portal
2. Navigate to: **Registration → For GSP**
3. Authenticate yourself with OTP
4. Click on "Add New User"
5. Create API credentials:
   - **Username**: Create a unique username
   - **Password**: Create a strong password
   - Note these down - you'll need them for the integration

### Step 3: Get GSP Access (Optional)

If you want to use a GSP (GST Suvidha Provider) instead of direct API:

1. Choose a GSP from the approved list
2. Contact them for API access
3. They will provide you with:
   - API URL
   - API Key
   - Documentation

---

## Environment Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```env
# E-Way Bill Configuration
EWAYBILL_API_URL=https://api.mastergst.com/ewaybillapi/v1.03
EWAYBILL_GSTIN=29AABCU9603R1ZM
EWAYBILL_USERNAME=your_username
EWAYBILL_PASSWORD=your_password
```

### 2. API URLs

**Sandbox (Testing)**:
```
https://sandbox.ewaybillgst.gov.in
```

**Production**:
```
https://api.ewaybillgst.gov.in
```

**MasterGST (Recommended for easy integration)**:
```
https://api.mastergst.com/ewaybillapi/v1.03
```

### 3. Install Dependencies

All required dependencies are already installed in this project.

---

## API Endpoints

### 1. Generate E-Way Bill

**Endpoint**: `POST /api/ewaybill/generate`

**Request Body**:
```json
{
  "supplyType": "O",
  "subSupplyType": "1",
  "subSupplyDesc": "",
  "docType": "INV",
  "docNo": "INV001",
  "docDate": "2025-10-31",
  "fromGstin": "29AABCU9603R1ZM",
  "fromTrdName": "ABC Company",
  "fromAddr1": "123 Main Street",
  "fromPlace": "Bangalore",
  "fromPincode": "560001",
  "fromStateCode": "29",
  "toGstin": "27AABCU9603R1ZM",
  "toTrdName": "XYZ Company",
  "toAddr1": "456 Park Avenue",
  "toPlace": "Mumbai",
  "toPincode": "400001",
  "toStateCode": "27",
  "transMode": "1",
  "vehicleNo": "KA01AB1234",
  "transDistance": "850",
  "items": [
    {
      "productName": "Rice",
      "hsnCode": "1006",
      "quantity": 100,
      "qtyUnit": "KGS",
      "taxableAmount": 50000,
      "cgstRate": 0,
      "sgstRate": 0,
      "igstRate": 5,
      "cessRate": 0
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "ewayBillNo": "391001547890",
  "ewayBillDate": "31/10/2025",
  "validUpto": "02/11/2025",
  "alert": "E-Way Bill generated successfully"
}
```

### 2. Get E-Way Bill Details

**Endpoint**: `GET /api/ewaybill/get?ewbNo=391001547890`

**Response**:
```json
{
  "success": true,
  "ewayBillNo": "391001547890",
  "ewayBillDate": "31/10/2025",
  "validUpto": "02/11/2025",
  "status": "ACT",
  "vehicleNo": "KA01AB1234",
  "fromGstin": "29AABCU9603R1ZM",
  "toGstin": "27AABCU9603R1ZM"
}
```

### 3. Update Vehicle Details

**Endpoint**: `PUT /api/ewaybill/update-vehicle`

**Request Body**:
```json
{
  "ewbNo": "391001547890",
  "vehicleNo": "KA02CD5678",
  "reasonCode": "1",
  "reasonRem": "Vehicle breakdown"
}
```

### 4. Cancel E-Way Bill

**Endpoint**: `POST /api/ewaybill/cancel`

**Request Body**:
```json
{
  "ewbNo": "391001547890",
  "cancelRsnCode": "2",
  "cancelRmrk": "Duplicate entry"
}
```

**Cancel Reason Codes**:
- `1`: Duplicate
- `2`: Data Entry Mistake
- `3`: Order Cancelled
- `4`: Others

---

## Usage Guide

### Accessing the E-Way Bill Page

Navigate to: **Dashboard → E-Way Bill** or visit `/dashboard/ewaybill`

### Generating an E-Way Bill

1. Click on "Generate" tab
2. Fill in all required details:
   - **Document Details**: Invoice number, date, type
   - **Supplier Details**: Your GSTIN and address
   - **Recipient Details**: Customer GSTIN and address
   - **Transport Details**: Vehicle number, distance, mode
   - **Items**: Add products with HSN codes and tax rates

3. Click "Add Item" for each product
4. Review the items table
5. Click "Generate E-Way Bill"
6. Note down the E-Way Bill number for future reference

### Searching for E-Way Bills

1. Click on "Search" tab
2. Enter the E-Way Bill number
3. Click "Search"
4. View complete details

### Updating Vehicle Details

1. Click on "Update Vehicle" tab
2. Enter E-Way Bill number
3. Enter new vehicle number
4. Provide reason for update
5. Click "Update Vehicle"

---

## Testing

### Using Sandbox Environment

1. Set `EWAYBILL_API_URL` to sandbox URL
2. Use test GSTIN: `05AAACG2115R1ZN`
3. Generate test E-Way Bills
4. All operations will be in test mode

### Test Credentials

Contact GSTN for sandbox credentials or use MasterGST's sandbox:
- URL: `https://sandbox.mastergst.com/ewaybillapi/v1.03`
- Request test credentials from MasterGST support

---

## Going to Production

### Checklist

- [ ] Obtain production API credentials from E-Way Bill portal
- [ ] Update `.env.local` with production credentials
- [ ] Change `EWAYBILL_API_URL` to production URL
- [ ] Test with real GSTIN and valid documents
- [ ] Ensure GST compliance (valid GSTIN, HSN codes, etc.)
- [ ] Set up error logging and monitoring
- [ ] Train users on the system

### Production URLs

**Direct GSTN API**:
```
https://api.ewaybillgst.gov.in
```

**MasterGST Production**:
```
https://api.mastergst.com/ewaybillapi/v1.03
```

### Important Notes

1. **GSTIN Validation**: All GSTINs must be valid and active
2. **HSN Codes**: Use correct HSN codes for products
3. **Distance Calculation**: Distance affects validity period
4. **Vehicle Number Format**: Should be in standard format (e.g., KA01AB1234)
5. **Cancellation Window**: E-Way Bills can only be cancelled within 24 hours

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Error**: "Authentication failed"

**Solution**:
- Verify username and password
- Check if API credentials are active
- Ensure GSTIN matches the credentials

#### 2. Invalid GSTIN

**Error**: "Invalid GSTIN"

**Solution**:
- Verify GSTIN is 15 characters
- Check if GSTIN is active on GST portal
- Ensure GSTIN format is correct

#### 3. E-Way Bill Generation Failed

**Error**: "Failed to generate E-Way Bill"

**Solution**:
- Check if all mandatory fields are filled
- Verify HSN codes are valid
- Ensure amount is greater than ₹50,000
- Check if supplier and recipient state codes are correct

#### 4. Token Expired

**Error**: "Token expired"

**Solution**:
- The system automatically refreshes tokens
- If issue persists, restart the application

#### 5. Vehicle Update Failed

**Error**: "Cannot update vehicle"

**Solution**:
- Check if E-Way Bill is still active
- Verify vehicle number format
- Ensure you're updating within the allowed time window

### Getting Help

1. **GSTN Help Desk**: 1800-102-4315 (E-Way Bill specific)
2. **Email Support**: helpdesk.ewb@gst.gov.in
3. **MasterGST Support**: sales@mastergst.com

---

## API Pricing

### Official GSTN API
- **Free**: Direct GSTN API is free
- **Cost**: Only registration on E-Way Bill portal required
- **No intermediary fees**

### GSP Providers (If using intermediary)

**MasterGST**:
- Contact for pricing: sales@mastergst.com

**GSTZen**:
- Without Storage: ₹0.18/bill (min 50,000/year)
- With Storage: ₹0.35/bill (min 25,000/year)

**ClearTax**:
- Contact for pricing: cleartax.in

---

## Important State Codes

| State | Code |
|-------|------|
| Andhra Pradesh | 37 |
| Karnataka | 29 |
| Kerala | 32 |
| Tamil Nadu | 33 |
| Telangana | 36 |
| Maharashtra | 27 |
| Delhi | 07 |
| Gujarat | 24 |
| Rajasthan | 08 |
| Uttar Pradesh | 09 |

[Complete list available on GST portal]

---

## HSN Code Examples

| Product | HSN Code |
|---------|----------|
| Rice | 1006 |
| Wheat | 1001 |
| Sugar | 1701 |
| Textiles | 5208 |
| Furniture | 9403 |
| Electronics | 8517 |

---

## Support & Documentation

- **Official Docs**: https://docs.ewaybillgst.gov.in/apidocs/
- **GST Portal**: https://www.gst.gov.in/
- **E-Way Bill Portal**: https://ewaybillgst.gov.in/
- **MasterGST Docs**: https://mastergst.com/e-way-bill/

---

## License

This integration is part of the Sadharmik & Company Supply Chain Management System.

For any questions or issues, contact the development team.
