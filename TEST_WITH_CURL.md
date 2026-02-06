# Testing with cURL Commands (Easy Way!)

## ✅ You've already done: `cds watch` is running

Now use these **exact commands** in a **new terminal** (keep `cds watch` running in the first terminal).

---

## Test 1: Create an Invitation

**Open a new terminal in BAS** and run:

```bash
curl -X POST http://localhost:4004/odata/v4/invitation/generateInvitation \
  -H "Content-Type: application/json" \
  -d '{
    "supplierEmail": "supplier@acme.com",
    "supplierName": "ACME Corporation"
  }'
```

**Expected response:**
```json
{
  "invitationID": "some-uuid-here",
  "invitationURL": "https://supplier-onboarding.example.com/onboard?token=MOCK_TOKEN_...",
  "token": "MOCK_TOKEN_1738840000_abc123def",
  "expiresAt": "2026-02-13T..."
}
```

**👉 COPY THE TOKEN from the response!** You'll need it for the next step.

---

## Test 2: Submit Supplier Data

**Replace `YOUR_TOKEN_HERE` with the actual token from Test 1:**

```bash
curl -X POST http://localhost:4004/odata/v4/supplier/submitData \
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
      "commodityCodes": "10.11.12",
      "certifications": "ISO 9001"
    }
  }'
```

**Expected response:**
```json
{
  "success": true,
  "supplierID": "some-uuid-here",
  "message": "Supplier data submitted successfully"
}
```

---

## Test 3: Verify in Browser

**Now go back to your browser tab** (the one showing the CAP welcome page):

1. Click on **Invitations** under InvitationService
2. You should see:
   - `status`: **"COMPLETED"**
   - `isUsed`: **true**

---

## Test 4: Try to Reuse Token (Should Fail!)

Run Test 2 again with the same token:

```bash
curl -X POST http://localhost:4004/odata/v4/supplier/submitData \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN_HERE",
    "companyData": {
      "companyName": "Test",
      "legalForm": "GmbH",
      "taxID": "DE123456789",
      "vatID": "DE999999999",
      "street": "Street",
      "city": "Berlin",
      "postalCode": "10115",
      "country": "DEU",
      "email": "test@test.com",
      "phone": "+49 30 12345678",
      "website": "https://test.com",
      "bankName": "Bank",
      "iban": "DE89370400440532013000",
      "swiftCode": "COBADEFF",
      "commodityCodes": "",
      "certifications": ""
    }
  }'
```

**Expected response:**
```json
{
  "error": {
    "code": "403",
    "message": "Invitation token has already been used"
  }
}
```

✅ **This error is GOOD!** It means single-use token enforcement works.

---

## Alternative: Use Postman/Thunder Client in BAS

If you prefer a GUI:

1. Install **Thunder Client** extension in BAS
2. Create a new request
3. Set method to **POST**
4. URL: `http://localhost:4004/odata/v4/invitation/generateInvitation`
5. Headers: `Content-Type: application/json`
6. Body: (raw JSON)
   ```json
   {
     "supplierEmail": "supplier@acme.com",
     "supplierName": "ACME Corporation"
   }
   ```
7. Click **Send**

---

## Quick Success Check

Run all 4 tests above, then reply:

```
✅ Test 1: Invitation created, got token
✅ Test 2: Supplier data submitted successfully
✅ Test 3: Invitation status = COMPLETED, isUsed = true
✅ Test 4: Token reuse blocked with 403 error

Ready for Step 5!
```

OR tell me which test failed and paste the error message.
