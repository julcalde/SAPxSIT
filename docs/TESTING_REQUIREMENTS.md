# Testing Requirements for CAP Standards Improvements

**Date:** February 4, 2026  
**Status:** Node.js not available in current environment

---

## ⚠️ Testing Prerequisites

The CAP standards improvements have been implemented but **require testing** in an environment with:

### Required Software:
- **Node.js** v18+ or v20+ (LTS recommended)
- **npm** v9+ or v10+
- **@sap/cds-dk** CLI toolkit

### Installation:
```bash
# Install Node.js (macOS with Homebrew)
brew install node

# Or download from: https://nodejs.org/

# Install CAP Development Kit globally
npm install -g @sap/cds-dk

# Install project dependencies
cd /Users/Guest/Desktop/sapxsit
npm install
```

---

## 🧪 Testing Checklist

### 1. CDS Schema Compilation
**Purpose:** Verify declarative validations syntax is correct

```bash
cd /Users/Guest/Desktop/sapxsit

# Compile CDS schema to CSN (Core Schema Notation)
cds compile db/schema.cds

# Compile to SQL DDL
cds compile db/schema.cds --to sql

# Check for syntax errors
echo $?  # Should return 0
```

**Expected:** No compilation errors, all @assert annotations recognized

---

### 2. Service Definition Validation
**Purpose:** Ensure service projections compile correctly

```bash
# Compile all services
cds compile srv/ --to csn

# Check admin service
cds compile srv/admin-service.cds

# Check invitation service
cds compile srv/invitation-service.cds

# Check supplier service
cds compile srv/supplier-service.cds
```

**Expected:** All services compile without errors

---

### 3. CAP Server Startup
**Purpose:** Verify application starts and loads all entities

```bash
# Start CAP development server
cds watch

# Or
cds serve
```

**Expected Output:**
```
[cds] - loaded model from 3 file(s):
  db/schema.cds
  srv/admin-service.cds
  srv/invitation-service.cds
  srv/supplier-service.cds
  
[cds] - connect to db > sqlite { database: ':memory:' }
[cds] - serving AdminService { path: '/admin' }
[cds] - serving InvitationService { path: '/invitation' }
[cds] - serving SupplierService { path: '/supplier' }

[cds] - launched in: 1234ms
[cds] - server listening on { url: 'http://localhost:4004' }
```

---

### 4. Declarative Validation Testing

#### Test 4.1: Email Format Validation
```bash
# Create test request (should PASS)
curl -X POST http://localhost:4004/supplier/MyOnboardingData \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "companyLegalName": "Test Company GmbH",
    "primaryContactEmail": "valid@example.com",
    "country_code": "DE"
  }'

# Expected: 201 Created (or validation passes)

# Create test request with invalid email (should FAIL)
curl -X POST http://localhost:4004/supplier/MyOnboardingData \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid-token>" \
  -d '{
    "companyLegalName": "Test Company GmbH",
    "primaryContactEmail": "invalid-email",
    "country_code": "DE"
  }'

# Expected: 400 Bad Request with validation error
```

#### Test 4.2: Tax ID Format Validation
```bash
# Valid Tax ID (should PASS)
curl -X POST ... -d '{
  "companyLegalName": "Test Company",
  "taxId": "DE123456789",
  "country_code": "DE"
}'

# Invalid Tax ID - too short (should FAIL)
curl -X POST ... -d '{
  "companyLegalName": "Test Company",
  "taxId": "123",
  "country_code": "DE"
}'

# Expected: 400 with error: "Tax ID must match format ^[A-Z0-9]{5,20}$"
```

#### Test 4.3: IBAN Format Validation
```bash
# Valid IBAN (should PASS)
curl -X POST ... -d '{
  "iban": "DE89370400440532013000"
}'

# Invalid IBAN (should FAIL)
curl -X POST ... -d '{
  "iban": "INVALID123"
}'

# Expected: 400 with IBAN format error
```

#### Test 4.4: Mandatory Field Validation
```bash
# Missing companyLegalName (should FAIL)
curl -X POST ... -d '{
  "country_code": "DE"
}'

# Expected: 400 with error: "companyLegalName is required"

# Empty companyLegalName (should FAIL)
curl -X POST ... -d '{
  "companyLegalName": "A",
  "country_code": "DE"
}'

# Expected: 400 with error: "companyLegalName must be 2-255 characters"
```

---

### 5. Business Logic Validation (Still in JS)

#### Test 5.1: Tax ID OR VAT Number Required
```bash
# Neither taxId nor vatNumber (should FAIL)
curl -X POST .../submitSupplierData -d '{
  "companyLegalName": "Test",
  "country_code": "DE"
}'

# Expected: Error "Either Tax ID or VAT number is required"

# Only taxId (should PASS)
curl -X POST .../submitSupplierData -d '{
  "companyLegalName": "Test",
  "taxId": "DE123456789",
  "country_code": "DE"
}'

# Only vatNumber (should PASS)
curl -X POST .../submitSupplierData -d '{
  "companyLegalName": "Test",
  "vatNumber": "DE999888777",
  "country_code": "DE"
}'
```

#### Test 5.2: Attachment Required
```bash
# Submit without attachments (should FAIL)
curl -X POST .../submitSupplierData -d '{
  "companyLegalName": "Test Company",
  "taxId": "DE123456789"
}'

# Expected: Error "At least one supporting document is required"
```

---

### 6. Code Reduction Verification

**Check lines of code removed:**
```bash
# Original supplier-service.js validation logic
git show HEAD~1:srv/supplier-service.js | grep -A 50 "Step 1: Validate all required fields" | wc -l

# New supplier-service.js validation logic
cat srv/supplier-service.js | grep -A 30 "Step 1: Business logic validations" | wc -l

# Difference should be ~100-150 lines removed
```

---

### 7. Metadata Inspection

**Verify UI annotations are present:**
```bash
# Get entity metadata as JSON
curl http://localhost:4004/$metadata

# Check for @title annotations
cds compile db/schema.cds --to json | grep -i "@title" | head -20

# Should show titles for all fields
```

---

## ✅ Success Criteria

- [ ] CDS schema compiles without errors
- [ ] All services start successfully
- [ ] Email validation rejects invalid formats
- [ ] Tax ID validation enforces 5-20 character rule
- [ ] IBAN validation enforces correct format
- [ ] Mandatory fields cannot be empty
- [ ] companyLegalName requires 2-255 characters
- [ ] Business logic still validates "taxId OR vatNumber"
- [ ] Business logic still requires attachments
- [ ] ~150 lines of validation code removed from JS
- [ ] UI metadata annotations present in $metadata
- [ ] No functional regressions from previous behavior

---

## 🔧 Troubleshooting

### Error: "Unknown annotation @assert.format"
**Solution:** Update @sap/cds to latest version:
```bash
npm install @sap/cds@latest
```

### Error: "Cannot read property 'assert' of undefined"
**Solution:** Check CDS version supports @assert annotations (v6.0+):
```bash
cds version
npm list @sap/cds
```

### Validation not working
**Solution:** Ensure CDS is handling validations, not bypassed:
```bash
# Check if using cds.ql API (not raw SQL)
grep -r "INSERT.into" srv/*.js
grep -r "UPDATE.entity" srv/*.js
```

---

## 📊 Performance Impact

Expected performance improvements:
- **Faster validation:** CDS validates before entering custom handlers
- **Less code execution:** ~150 fewer lines of JavaScript to execute
- **Better error messages:** Framework-generated errors with field names
- **Reduced memory:** No validator function objects in memory

---

## 🚀 Next Steps After Testing

If all tests pass:
1. Update test suites to cover new validation behavior
2. Document CDS @assert patterns for team
3. Consider Priority 2 improvements (S/4HANA Calesi pattern)
4. Proceed with Step 13: Object Store destination configuration

If tests fail:
1. Review CDS compilation errors
2. Check @assert syntax in schema.cds
3. Verify CAP version compatibility
4. Roll back to previous commit if needed: `git reset --hard HEAD~1`
