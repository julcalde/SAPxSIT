# Complete Testing Guide - Supplier Onboarding CAP Backend

**Project:** SAP BTP Supplier Self-Onboarding  
**Steps Completed:** 1-4 (Foundation, Domain Model, CRUD, Validations)  
**Environment:** SAP Business Application Studio  
**Last Updated:** February 6, 2026

---

## 🚀 Prerequisites

### 1. Start the CAP Service in BAS

```bash
cd /home/user/projects/SAPxSIT
npm install  # Only needed first time
cds watch
```

**Wait for:**
```
[cds] - server listening on { url: 'http://localhost:4004' }
```

### 2. Get the Exposed URL

**BAS will show notification:** `"A service is listening to port 4004"`

**Click:** "Expose and Open"

**Copy the URL from browser** (looks like):
```
https://port4004-workspaces-ws-xxxxx.us10.trial.applicationstudio.cloud.sap
```

**👉 Replace `{EXPOSED_URL}` in all commands below with this URL**

---

## 📋 Testing Steps 1-4: Core Functionality

### Test 1: Generate Invitation (CREATE)

**Purpose:** Verify invitation creation with token generation

**Method:** Open a NEW terminal in BAS (keep `cds watch` running)

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/invitation/generateInvitation \
  -H "Content-Type: application/json" \
  -d '{
    "supplierEmail": "supplier@acme.com",
    "supplierName": "ACME Corporation"
  }'
```

**Expected Response:**
```json
{
  "invitationID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "invitationURL": "https://supplier-onboarding.example.com/onboard?token=MOCK_TOKEN_1738840000_abc123",
  "token": "MOCK_TOKEN_1738840000_abc123",
  "expiresAt": "2026-02-13T10:30:00.000Z"
}
```

**✅ Success Criteria:**
- HTTP 200 status
- Token returned (starts with `MOCK_TOKEN_`)
- `invitationID` is a UUID
- `expiresAt` is 7 days in the future

**📋 Copy the token for next tests!**

---

### Test 2: Read Invitations (GET)

**Purpose:** Verify invitation data is stored and readable

**Command:**
```bash
curl -X GET {EXPOSED_URL}/odata/v4/invitation/Invitations
```

**Expected Response:**
```json
{
  "value": [
    {
      "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "supplierEmail": "supplier@acme.com",
      "supplierName": "ACME Corporation",
      "expiresAt": "2026-02-13T10:30:00.000Z",
      "status": "PENDING",
      "isUsed": false,
      "usedAt": null,
      "supplierCompanyName": null,
      "supplierStatus": null
    }
  ]
}
```

**✅ Success Criteria:**
- Invitation exists with correct email
- `status` = "PENDING"
- `isUsed` = false

---

### Test 3: Submit Supplier Data (CREATE)

**Purpose:** Verify supplier data submission and token validation

**👉 Replace `YOUR_TOKEN_HERE` with token from Test 1**

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
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
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "supplierID": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "message": "Supplier data submitted successfully"
}
```

**✅ Success Criteria:**
- HTTP 200 status
- `success` = true
- `supplierID` returned

**Check terminal logs for:**
```
[SupplierService] Received supplier data submission
[SupplierService] Created supplier ID: b2c3d4e5-...
```

---

### Test 4: Verify Invitation Marked as Used

**Purpose:** Confirm invitation status updated after submission

**Command:**
```bash
curl -X GET {EXPOSED_URL}/odata/v4/invitation/Invitations
```

**Expected Response:**
```json
{
  "value": [
    {
      "ID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "COMPLETED",
      "isUsed": true,
      "usedAt": "2026-02-06T10:35:00.000Z",
      "supplierCompanyName": "ACME Corporation",
      "supplierStatus": "PENDING"
    }
  ]
}
```

**✅ Success Criteria:**
- `status` changed to "COMPLETED"
- `isUsed` = true
- `usedAt` has timestamp
- `supplierCompanyName` populated

---

### Test 5: Token Reuse Prevention (Security)

**Purpose:** Verify single-use token enforcement

**Command:** (Use same token from Test 3 again)
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "companyData": {
      "companyName": "Another Company",
      "legalForm": "GmbH",
      "taxID": "DE987654321",
      "vatID": "DE888888888",
      "street": "Street 1",
      "city": "Munich",
      "postalCode": "80331",
      "country": "DEU",
      "email": "test@test.com",
      "phone": "+49 89 12345678",
      "website": "https://test.com",
      "bankName": "Test Bank",
      "iban": "DE89370400440532013000",
      "swiftCode": "COBADEFF",
      "commodityCodes": "",
      "certifications": ""
    }
  }'
```

**Expected Response (ERROR - this is GOOD!):**
```json
{
  "error": {
    "code": "403",
    "message": "Invitation token has already been used"
  }
}
```

**✅ Success Criteria:**
- HTTP 403 Forbidden
- Clear error message about token reuse

---

### Test 6: Invalid Token Rejection

**Purpose:** Verify invalid tokens are rejected

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "INVALID_TOKEN_123",
    "companyData": {
      "companyName": "Test Company",
      "legalForm": "GmbH",
      "taxID": "DE123456789",
      "vatID": "DE999999999",
      "street": "Street 1",
      "city": "Berlin",
      "postalCode": "10115",
      "country": "DEU",
      "email": "test@test.com",
      "phone": "+49 30 12345678",
      "website": "https://test.com",
      "bankName": "Test Bank",
      "iban": "DE89370400440532013000",
      "swiftCode": "COBADEFF",
      "commodityCodes": "",
      "certifications": ""
    }
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "401",
    "message": "Invalid or expired invitation token"
  }
}
```

**✅ Success Criteria:**
- HTTP 401 Unauthorized
- Token validation failed

---

## 🧪 Validation Tests (Input Validation - Step 4)

### Test 7: Invalid Email Format

**Purpose:** Verify email validation

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/invitation/generateInvitation \
  -H "Content-Type: application/json" \
  -d '{
    "supplierEmail": "invalid-email-format",
    "supplierName": "Test Company"
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "400",
    "message": "Invalid email format"
  }
}
```

**✅ Success Criteria:**
- HTTP 400 Bad Request
- Email validation working

---

### Test 8: Duplicate Invitation Prevention

**Purpose:** Verify duplicate detection

**Command:** (Use same email from Test 1 - must create a new invitation first if expired)
```bash
curl -X POST {EXPOSED_URL}/odata/v4/invitation/generateInvitation \
  -H "Content-Type: application/json" \
  -d '{
    "supplierEmail": "supplier@acme.com",
    "supplierName": "ACME Corporation"
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "409",
    "message": "Active invitation already exists for supplier@acme.com. Expires at 2026-02-13T10:30:00.000Z"
  }
}
```

**✅ Success Criteria:**
- HTTP 409 Conflict
- Duplicate prevention working

---

### Test 9: Missing Required Fields

**Purpose:** Verify required field validation

**Command:**
```bash
# Generate fresh token first
curl -X POST {EXPOSED_URL}/odata/v4/invitation/generateInvitation \
  -H "Content-Type: application/json" \
  -d '{
    "supplierEmail": "test2@acme.com",
    "supplierName": "Test Company 2"
  }'

# Copy new token, then submit incomplete data
curl -X POST {EXPOSED_URL}/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "NEW_TOKEN_HERE",
    "companyData": {
      "companyName": "Incomplete Corp"
    }
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "400",
    "message": "Field 'taxID' is required"
  }
}
```

**✅ Success Criteria:**
- HTTP 400 Bad Request
- Identifies first missing required field

---

### Test 10: Invalid Country Code Format

**Purpose:** Verify country code validation (ISO 3166-1 alpha-3)

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_VALID_TOKEN_HERE",
    "companyData": {
      "companyName": "Test Corp",
      "legalForm": "GmbH",
      "taxID": "DE123456789",
      "vatID": "DE999999999",
      "street": "Street 1",
      "city": "Berlin",
      "postalCode": "10115",
      "country": "GERMANY",
      "email": "test@test.com",
      "phone": "+49 30 12345678",
      "website": "https://test.com",
      "bankName": "Test Bank",
      "iban": "DE89370400440532013000",
      "swiftCode": "COBADEFF",
      "commodityCodes": "",
      "certifications": ""
    }
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "400",
    "message": "Country code must be 3 uppercase letters (ISO 3166-1 alpha-3)"
  }
}
```

**✅ Success Criteria:**
- HTTP 400 Bad Request
- Country code validation enforced (must be 3 letters: DEU, USA, GBR, etc.)

---

### Test 11: Invalid IBAN Format

**Purpose:** Verify IBAN validation

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_VALID_TOKEN_HERE",
    "companyData": {
      "companyName": "Test Corp",
      "legalForm": "GmbH",
      "taxID": "DE123456789",
      "vatID": "DE999999999",
      "street": "Street 1",
      "city": "Berlin",
      "postalCode": "10115",
      "country": "DEU",
      "email": "test@test.com",
      "phone": "+49 30 12345678",
      "website": "https://test.com",
      "bankName": "Test Bank",
      "iban": "INVALID-IBAN-FORMAT",
      "swiftCode": "COBADEFF",
      "commodityCodes": "",
      "certifications": ""
    }
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "400",
    "message": "Invalid IBAN format (must start with 2 letters, 2 digits, followed by alphanumeric)"
  }
}
```

**✅ Success Criteria:**
- HTTP 400 Bad Request
- IBAN format validation enforced

---

### Test 12: Request Presigned Upload URL (Mock)

**Purpose:** Verify file upload URL generation

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/requestUploadURL \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_VALID_TOKEN_HERE",
    "fileName": "company-certificate.pdf",
    "fileType": "application/pdf",
    "fileSize": 2048576
  }'
```

**Expected Response:**
```json
{
  "presignedUrl": "https://mock-s3.example.com/upload?key=uploads/a1b2c3d4-.../1738840200-company-certificate.pdf&signature=MOCK",
  "expiresIn": 3600,
  "s3Key": "uploads/a1b2c3d4-.../1738840200-company-certificate.pdf"
}
```

**✅ Success Criteria:**
- HTTP 200 status
- Presigned URL generated
- S3 key includes invitation ID

---

### Test 13: File Size Validation (Max 10MB)

**Purpose:** Verify file size limits

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/requestUploadURL \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_VALID_TOKEN_HERE",
    "fileName": "huge-file.pdf",
    "fileType": "application/pdf",
    "fileSize": 20971520
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "400",
    "message": "File size exceeds maximum limit of 10MB"
  }
}
```

**✅ Success Criteria:**
- HTTP 400 Bad Request
- File size limit enforced (10MB = 10,485,760 bytes)

---

### Test 14: File Type Validation (Whitelist)

**Purpose:** Verify file type restrictions

**Command:**
```bash
curl -X POST {EXPOSED_URL}/odata/v4/supplier/requestUploadURL \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_VALID_TOKEN_HERE",
    "fileName": "malware.exe",
    "fileType": "application/x-msdownload",
    "fileSize": 1024
  }'
```

**Expected Response:**
```json
{
  "error": {
    "code": "400",
    "message": "File type 'application/x-msdownload' is not allowed. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX"
  }
}
```

**✅ Success Criteria:**
- HTTP 400 Bad Request
- File type whitelist enforced

**Allowed MIME types:**
- `application/pdf`
- `image/jpeg`
- `image/png`
- `application/msword`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/vnd.ms-excel`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

## 📊 Database Inspection (Optional)

**Connect to SQLite database:**
```bash
sqlite3 db.sqlite
```

**View all invitations:**
```sql
SELECT ID, supplierEmail, status, isUsed, expiresAt 
FROM supplier_onboarding_Invitations;
```

**View all suppliers:**
```sql
SELECT ID, companyName, country, email, s4hanaStatus 
FROM supplier_onboarding_Suppliers;
```

**View all attachments:**
```sql
SELECT ID, fileName, fileType, fileSize, uploadStatus 
FROM supplier_onboarding_Attachments;
```

**Exit SQLite:**
```sql
.quit
```

---

## ✅ Complete Test Checklist

**Step 1-2: Foundation & Domain Model**
- [ ] Service starts successfully (`cds watch`)
- [ ] Port 4004 exposed and accessible
- [ ] SQLite database created

**Step 3: CRUD Operations**
- [ ] Test 1: Generate invitation ✅
- [ ] Test 2: Read invitations ✅
- [ ] Test 3: Submit supplier data ✅
- [ ] Test 4: Invitation marked as used ✅

**Step 4: Validation & Error Handling**
- [ ] Test 5: Token reuse prevented ✅
- [ ] Test 6: Invalid token rejected ✅
- [ ] Test 7: Email format validated ✅
- [ ] Test 8: Duplicate invitation prevented ✅
- [ ] Test 9: Missing required fields rejected ✅
- [ ] Test 10: Country code validated ✅
- [ ] Test 11: IBAN format validated ✅
- [ ] Test 12: Presigned URL generated (mock) ✅
- [ ] Test 13: File size limit enforced ✅
- [ ] Test 14: File type whitelist enforced ✅

---

## 🔍 Console Log Verification

**Successful invitation creation:**
```
[InvitationService] Generating invitation for supplier@acme.com
[InvitationService] Created invitation ID: a1b2c3d4-...
```

**Successful supplier submission:**
```
[SupplierService] Received supplier data submission
[SupplierService] Created supplier ID: b2c3d4e5-...
```

**Token validation failure:**
```
[SupplierService] Received supplier data submission
(No "Created supplier ID" message - validation failed)
```

---

## 🎯 Success Report Format

**Copy and paste after testing:**

```
✅ STEPS 1-4 TESTING COMPLETE

Environment:
- BAS URL: https://port4004-workspaces-ws-xxxxx...
- Service running: YES
- Database: SQLite (db.sqlite)

Test Results (14 tests):
✅ Test 1: Invitation created
✅ Test 2: Invitations readable
✅ Test 3: Supplier data submitted
✅ Test 4: Invitation marked as used
✅ Test 5: Token reuse blocked (403)
✅ Test 6: Invalid token blocked (401)
✅ Test 7: Email validation (400)
✅ Test 8: Duplicate prevention (409)
✅ Test 9: Required fields enforced (400)
✅ Test 10: Country code validation (400)
✅ Test 11: IBAN validation (400)
✅ Test 12: Presigned URL generated
✅ Test 13: File size limit (400)
✅ Test 14: File type whitelist (400)

READY FOR STEP 5: JWT Token Implementation
```

---

## 🐛 Troubleshooting

### Issue: Connection refused

**Solution:**
1. Verify `cds watch` is running
2. Check port 4004 is exposed ("Expose and Open")
3. Use HTTPS exposed URL, not `http://localhost:4004`

### Issue: 404 Not Found on action

**Solution:**
- Verify URL path: `/odata/v4/invitation/generateInvitation` (exact spelling)
- Check service is running without errors

### Issue: Database locked

**Solution:**
```bash
rm db.sqlite
cds watch  # Will recreate database
```

### Issue: npm install fails

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 📚 Next Steps

Once all 14 tests pass, we proceed to:

**Step 5: JWT Token Implementation**
- Replace mock tokens with real JWT
- Use `jsonwebtoken` library
- 15-minute expiration
- Signature validation
- Audience validation
- SHA-256 token hashing

---

**Last Updated:** February 6, 2026  
**Keep this file for reference!** All testing procedures documented for Steps 1-4.
