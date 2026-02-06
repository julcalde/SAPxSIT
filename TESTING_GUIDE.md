# Testing Guide for Supplier Onboarding CAP Backend

## Current Implementation Status (Steps 1-4 Completed)

✅ **Step 1:** CAP project initialized with domain models and service stubs  
✅ **Step 2:** Domain model validations and constraints added  
✅ **Step 3:** CRUD operations implemented for Invitations and Suppliers  
✅ **Step 4:** Comprehensive input validation and error handling added  

---

## Testing in SAP Business Application Studio (BAS)

### 1. Start the CAP Service

In BAS terminal, run:

```bash
cd /home/user/projects/SAPxSIT
cds watch
```

**Expected Output:**
```
[cds] - loaded model from 2 file(s):
  db/schema.cds
  srv/invitation-service.cds
  srv/supplier-service.cds

[cds] - connect to db > sqlite { database: 'db.sqlite' }
> init db.sqlite

[cds] - serving InvitationService { path: '/odata/v4/invitation' }
[cds] - serving SupplierService { path: '/odata/v4/supplier' }

[cds] - server listening on { url: 'http://localhost:4004' }
[cds] - launched at 2/6/2026, 10:30:00 AM, version: 8.x.x, in: 1.2s
```

### 2. Open the Test UI

BAS will show a notification: **"A service is listening to port 4004"**

Click **"Expose and Open"** or **"Open in New Tab"**

You should see the **CAP Welcome Page** with:
- `/odata/v4/invitation` - InvitationService
- `/odata/v4/supplier` - SupplierService

---

## Test Scenarios

### Test 1: Generate an Invitation (Happy Path)

**Endpoint:** `POST /odata/v4/invitation/generateInvitation`

**Request Body:**
```json
{
  "supplierEmail": "test.supplier@acme.com",
  "supplierName": "ACME Corporation"
}
```

**How to Test in BAS:**

1. Click on **InvitationService** link
2. Click on **`generateInvitation`** action
3. Fill in the parameters:
   - `supplierEmail`: `test.supplier@acme.com`
   - `supplierName`: `ACME Corporation`
4. Click **Execute**

**Expected Response:**
```json
{
  "invitationID": "a1b2c3d4-...",
  "invitationURL": "https://supplier-onboarding.example.com/onboard?token=MOCK_TOKEN_...",
  "token": "MOCK_TOKEN_1738840000_abc123def",
  "expiresAt": "2026-02-13T10:30:00.000Z"
}
```

**Verify in Console Logs:**
```
[InvitationService] Generating invitation for test.supplier@acme.com
[InvitationService] Created invitation ID: a1b2c3d4-...
```

---

### Test 2: Validate Email Format (Error Case)

**Request Body:**
```json
{
  "supplierEmail": "invalid-email",
  "supplierName": "Test Company"
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": {
    "code": "400",
    "message": "Invalid email format"
  }
}
```

---

### Test 3: Duplicate Active Invitation (Error Case)

Try creating another invitation with the same email:

**Request Body:**
```json
{
  "supplierEmail": "test.supplier@acme.com",
  "supplierName": "ACME Corporation"
}
```

**Expected Response:** `409 Conflict`
```json
{
  "error": {
    "code": "409",
    "message": "Active invitation already exists for test.supplier@acme.com. Expires at 2026-02-13T10:30:00.000Z"
  }
}
```

---

### Test 4: Read Invitations

**Endpoint:** `GET /odata/v4/invitation/Invitations`

1. Click on **InvitationService**
2. Click on **Invitations** entity
3. Click **Go** to load data

**Expected Response:**
```json
{
  "value": [
    {
      "ID": "a1b2c3d4-...",
      "supplierEmail": "test.supplier@acme.com",
      "supplierName": "ACME Corporation",
      "status": "PENDING",
      "isUsed": false,
      "expiresAt": "2026-02-13T10:30:00.000Z",
      "supplierCompanyName": null,
      "supplierStatus": null
    }
  ]
}
```

---

### Test 5: Submit Supplier Data (Happy Path)

**Endpoint:** `POST /odata/v4/supplier/submitData`

**Request Body:**
```json
{
  "token": "MOCK_TOKEN_1738840000_abc123def",
  "companyData": {
    "companyName": "ACME Corporation",
    "legalForm": "GmbH",
    "taxID": "DE123456789",
    "vatID": "DE999999999",
    "street": "Main Street 123",
    "city": "Berlin",
    "postalCode": "10115",
    "country": "DEU",
    "email": "contact@acme.com",
    "phone": "+49 30 12345678",
    "website": "https://acme.com",
    "bankName": "Deutsche Bank",
    "iban": "DE89370400440532013000",
    "swiftCode": "COBADEFF",
    "commodityCodes": "10.11.12, 20.30.40",
    "certifications": "ISO 9001, ISO 14001"
  }
}
```

**How to Test:**

1. Copy the **token** from Test 1 response
2. Click on **SupplierService**
3. Click on **`submitData`** action
4. Paste the token and company data
5. Click **Execute**

**Expected Response:**
```json
{
  "success": true,
  "supplierID": "e5f6g7h8-...",
  "message": "Supplier data submitted successfully"
}
```

**Verify in Console Logs:**
```
[SupplierService] Received supplier data submission
[SupplierService] Created supplier ID: e5f6g7h8-...
```

---

### Test 6: Verify Invitation Marked as Used

**Endpoint:** `GET /odata/v4/invitation/Invitations`

Reload the Invitations list.

**Expected Response:**
```json
{
  "value": [
    {
      "ID": "a1b2c3d4-...",
      "status": "COMPLETED",
      "isUsed": true,
      "usedAt": "2026-02-06T10:35:00.000Z",
      "supplierCompanyName": "ACME Corporation",
      "supplierStatus": "PENDING"
    }
  ]
}
```

---

### Test 7: Token Reuse Prevention (Error Case)

Try submitting data again with the same token.

**Expected Response:** `403 Forbidden`
```json
{
  "error": {
    "code": "403",
    "message": "Invitation token has already been used"
  }
}
```

---

### Test 8: Invalid Token (Error Case)

**Request Body:**
```json
{
  "token": "INVALID_TOKEN_123",
  "companyData": { ... }
}
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": {
    "code": "401",
    "message": "Invalid or expired invitation token"
  }
}
```

---

### Test 9: Missing Required Fields (Error Case)

**Request Body:**
```json
{
  "token": "MOCK_TOKEN_...",
  "companyData": {
    "companyName": "Test Co"
    // Missing taxID, vatID, etc.
  }
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": {
    "code": "400",
    "message": "Field 'taxID' is required"
  }
}
```

---

### Test 10: Request Presigned Upload URL

**Endpoint:** `POST /odata/v4/supplier/requestUploadURL`

**Request Body:**
```json
{
  "token": "MOCK_TOKEN_...",
  "fileName": "company-certificate.pdf",
  "fileType": "application/pdf",
  "fileSize": 2048576
}
```

**Expected Response:**
```json
{
  "presignedUrl": "https://mock-s3.example.com/upload?key=uploads/a1b2c3d4-.../1738840200-company-certificate.pdf&signature=MOCK",
  "expiresIn": 3600,
  "s3Key": "uploads/a1b2c3d4-.../1738840200-company-certificate.pdf"
}
```

---

### Test 11: File Size Validation (Error Case)

**Request Body:**
```json
{
  "token": "MOCK_TOKEN_...",
  "fileName": "huge-file.pdf",
  "fileType": "application/pdf",
  "fileSize": 20971520
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": {
    "code": "400",
    "message": "File size exceeds maximum limit of 10MB"
  }
}
```

---

### Test 12: Invalid File Type (Error Case)

**Request Body:**
```json
{
  "token": "MOCK_TOKEN_...",
  "fileName": "malware.exe",
  "fileType": "application/x-msdownload",
  "fileSize": 1024
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": {
    "code": "400",
    "message": "File type 'application/x-msdownload' is not allowed. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX"
  }
}
```

---

## Database Inspection (Optional)

To inspect the SQLite database directly in BAS:

```bash
sqlite3 db.sqlite
```

**Useful queries:**

```sql
-- View all invitations
SELECT ID, supplierEmail, status, isUsed, expiresAt FROM supplier_onboarding_Invitations;

-- View all suppliers
SELECT ID, companyName, country, s4hanaStatus FROM supplier_onboarding_Suppliers;

-- View all attachments
SELECT ID, fileName, fileSize, uploadStatus FROM supplier_onboarding_Attachments;

-- Exit SQLite
.quit
```

---

## Validation Checklist

Before proceeding to **Step 5 (JWT Token Implementation)**, verify:

- [ ] ✅ `cds watch` starts without errors
- [ ] ✅ CAP Welcome Page accessible in browser
- [ ] ✅ InvitationService and SupplierService endpoints listed
- [ ] ✅ Test 1: Invitation created successfully
- [ ] ✅ Test 2: Email validation rejects invalid format
- [ ] ✅ Test 3: Duplicate invitation prevented
- [ ] ✅ Test 4: Invitations can be read via OData
- [ ] ✅ Test 5: Supplier data submitted successfully
- [ ] ✅ Test 6: Invitation marked as used after submission
- [ ] ✅ Test 7: Token reuse blocked
- [ ] ✅ Test 8: Invalid token rejected
- [ ] ✅ Test 9: Missing required fields rejected
- [ ] ✅ Test 10: Presigned URL generated
- [ ] ✅ Test 11: File size validation works
- [ ] ✅ Test 12: File type validation works

---

## Troubleshooting

### Issue: `cds watch` fails with "Cannot find module '@sap/cds'"

**Solution:**
```bash
npm install
```

### Issue: Port 4004 already in use

**Solution:**
```bash
# Kill existing process
pkill -f "cds watch"

# Or use a different port
cds watch --port 4005
```

### Issue: Database locked error

**Solution:**
```bash
# Delete and recreate database
rm db.sqlite
cds deploy --to sqlite:db.sqlite
```

### Issue: Changes not reflected

**Solution:**
- Save all files (Ctrl+S / Cmd+S)
- `cds watch` should auto-reload
- If not, stop (Ctrl+C) and restart `cds watch`

---

## Next Steps

Once all tests pass, report back with:

1. **Confirmation:** "All 12 tests passed successfully"
2. **Any issues encountered** (if applicable)
3. **Ready to proceed:** "Ready for Step 5 - JWT Token Implementation"

Then I will guide you through implementing real JWT tokens with:
- Token generation with `jsonwebtoken` library
- Signature validation
- Expiration enforcement
- Audience validation
- SHA-256 token hashing
