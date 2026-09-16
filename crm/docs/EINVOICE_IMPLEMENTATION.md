# E-Invoice and E-Way Bill Implementation Guide

## Overview

This implementation provides integration with India's GST E-Invoice and E-Way Bill system through the official GSTN APIs. The system allows you to:

- Generate E-Invoices for B2B transactions
- Generate E-Way Bills (standalone or with IRN)
- Cancel E-Invoices (within 24 hours)
- Update vehicle details for E-Way Bills
- View and manage all generated documents

## Features Implemented

### 1. E-Invoice Management (`/dashboard/einvoice`)
- **Generate E-Invoice**: Create e-invoices from existing orders or purchases
- **View E-Invoices**: List all generated e-invoices with status
- **Cancel E-Invoice**: Cancel within 24 hours of generation
- **Generate E-Way Bill from IRN**: Create e-way bill using Invoice Reference Number
- **Download Invoice**: Export e-invoice with QR code
- **View QR Code**: Display signed QR code for verification

### 2. E-Way Bill Management (`/dashboard/ewaybill`)
- **Generate E-Way Bill**: Create standalone e-way bills
- **Search E-Way Bills**: Find e-way bills by number
- **Update Vehicle**: Update vehicle details during transit
- **Cancel E-Way Bill**: Cancel e-way bills when needed

## Database Schema

### Tables Created

1. **einvoices**: Stores e-invoice data
   - IRN, acknowledgment number, QR code
   - Buyer/Seller details
   - Value details (CGST, SGST, IGST)
   - Status tracking

2. **einvoice_items**: Line items for each e-invoice
   - Product details
   - HSN codes
   - Tax calculations

3. **ewaybills**: E-way bill records
   - E-way bill number and validity
   - Transport details
   - Vehicle information
   - Link to e-invoice (if applicable)

## API Endpoints

### E-Invoice APIs
- `POST /api/einvoice/generate` - Generate new e-invoice
- `GET /api/einvoice/list` - List all e-invoices
- `POST /api/einvoice/cancel` - Cancel e-invoice
- `POST /api/einvoice/generate-ewaybill` - Generate e-way bill from IRN
- `GET /api/orders/pending-einvoice` - Get orders pending e-invoice

### E-Way Bill APIs (Existing)
- `POST /api/ewaybill/generate` - Generate standalone e-way bill
- `GET /api/ewaybill/get` - Get e-way bill details
- `PUT /api/ewaybill/update-vehicle` - Update vehicle details
- `POST /api/ewaybill/cancel` - Cancel e-way bill

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# GSTN E-Invoice & E-Way Bill Configuration
GSTN_BASE_URL=https://einv-apisandbox.nic.in  # Use sandbox for testing
GSTN_SANDBOX=true
GSTN_CLIENT_ID=your_client_id
GSTN_CLIENT_SECRET=your_client_secret
GSTN_USERNAME=your_username
GSTN_PASSWORD=your_password

# Company Details
COMPANY_GSTIN=29AABCU9603R1ZM
COMPANY_NAME=Your Company Name
COMPANY_ADDRESS_LINE1=Building, Floor
COMPANY_ADDRESS_LINE2=Street, Area
COMPANY_CITY=Bangalore
COMPANY_STATE=Karnataka
COMPANY_PINCODE=560001
COMPANY_PHONE=9876543210
COMPANY_EMAIL=accounts@company.com
```

### GSTN API Registration

1. **For Testing (Sandbox)**:
   - Visit: https://einv-apisandbox.nic.in
   - Register for sandbox access
   - Get test credentials

2. **For Production**:
   - Register on GST portal
   - Get API access from GSTN
   - Update `GSTN_BASE_URL` to production URL

## Usage Instructions

### Generating E-Invoice

1. Navigate to `/dashboard/einvoice`
2. Click on "Generate" tab
3. Select an order with customer GST number
4. Click "Generate E-Invoice"
5. System will:
   - Call GSTN API
   - Get IRN and QR code
   - Save to database
   - Display success message

### Generating E-Way Bill with IRN

1. From E-Invoice list, locate the invoice
2. Click "Generate" button in E-Way Bill column
3. System generates e-way bill using the IRN
4. E-Way bill number is displayed

### Important Validations

1. **E-Invoice Requirements**:
   - Customer must have valid GSTIN
   - Order must be in delivered/completed status
   - All items must have HSN codes
   - Cannot modify after generation

2. **E-Way Bill Requirements**:
   - Valid for goods worth > ₹50,000
   - Distance-based validity (1 day per 100km)
   - Vehicle details can be updated during transit

3. **Cancellation Rules**:
   - E-Invoice: Within 24 hours only
   - E-Way Bill: Before goods movement starts
   - Requires cancellation reason

## Testing

### Test Data Requirements

For sandbox testing, use:
- Valid test GSTINs provided by sandbox
- HSN codes: Use 4-8 digit codes
- State codes: 01-37 (valid Indian state codes)

### Common Test Scenarios

1. **B2B Invoice**: Customer with GSTIN
2. **B2C Invoice**: Customer without GSTIN (use 'URP')
3. **Interstate**: Different state codes (IGST applies)
4. **Intrastate**: Same state codes (CGST+SGST)

## Error Handling

The system handles:
- API authentication failures
- Invalid GSTIN formats
- Missing required fields
- Network timeouts
- Rate limiting

Error messages are logged and user-friendly messages are shown.

## Security Considerations

1. **API Credentials**: Store securely in environment variables
2. **Encryption**: API client uses AES-256 for sensitive data
3. **Authentication**: Token-based with auto-refresh
4. **Audit Trail**: All operations are logged in database

## Troubleshooting

### Common Issues

1. **Authentication Failed**:
   - Check credentials in .env
   - Verify GSTIN format
   - Ensure API access is enabled

2. **Invalid IRN**:
   - Check if invoice already exists
   - Verify all required fields
   - Ensure HSN codes are valid

3. **E-Way Bill Generation Failed**:
   - Check if distance is provided
   - Verify transport mode
   - Ensure IRN is valid

## API Rate Limits

- Sandbox: 100 requests per hour
- Production: Based on your plan
- Implement caching where possible

## Support Resources

- GSTN E-Invoice Portal: https://einvoice.gst.gov.in
- API Documentation: https://einv-apisandbox.nic.in/index.html
- Help Desk: https://selfservice.gstsystem.in/

## Future Enhancements

- Bulk e-invoice generation
- Auto-retry for failed requests
- Email notifications for document generation
- Integration with accounting software
- Automated e-way bill extension
- Mobile app for tracking

## Compliance Notes

- Mandatory for businesses with turnover > ₹5 Crores
- Certain sectors exempted (SEZ, Banking, Insurance)
- Keep records for 6 years
- Regular reconciliation with GST returns required