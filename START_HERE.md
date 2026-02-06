# 🚀 Testing Your Implementation in BAS

## Your Current Project State

✅ **Steps 1-4 Complete**
- Domain models defined
- Services implemented
- Validation & error handling added
- Ready for testing!

---

## 📋 3-Step Quick Test (5 minutes)

### Open in BAS Terminal:
```bash
cd /home/user/projects/SAPxSIT
cds watch
```

### When port 4004 opens, click "Expose and Open"

---

## 🎯 Testing Method: Use Terminal Commands!

**The browser page only shows OData entities, not custom actions.**

**👉 Use the curl commands instead!** See **[TEST_WITH_CURL.md](TEST_WITH_CURL.md)**

### Quick Commands:

**In a NEW terminal** (keep `cds watch` running):

**1️⃣ CREATE INVITATION:**
```bash
curl -X POST http://localhost:4004/odata/v4/invitation/generateInvitation \
  -H "Content-Type: application/json" \
  -d '{"supplierEmail": "supplier@acme.com", "supplierName": "ACME Corp"}'
```
👉 **COPY THE TOKEN from response!**

---

**2️⃣ SUBMIT DATA** (replace `YOUR_TOKEN_HERE`):
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

---

**3️⃣ VERIFY in Browser:**
- Refresh the **Invitations** page in browser
- Check: `status` = "COMPLETED", `isUsed` = true

---

## 📁 Files Ready for You

| File | Purpose |
|------|---------|
| **QUICK_TEST.md** | This guide (quick reference) |
| **TESTING_GUIDE.md** | Full 12-test scenario guide |
| **test-api.http** | REST Client file (17 requests) |
| **STATUS.md** | Complete implementation status |

---

## ✅ Success = Report Back

```
✅ All tests passed
Ready for Step 5
```

## ❌ Issues = Report Details

```
❌ Issue: [describe what failed]
Error: [paste error message]
```

---

## 🎯 Next Up: Step 5 - Real JWT Tokens

Once testing passes, I'll guide you through:
- Implementing real JWT token generation
- Token signature validation
- 15-minute expiration
- SHA-256 hashing
- Audience validation

**You're doing great! Test it and let me know the results! 🎉**
