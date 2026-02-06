# Quick Testing Reference Card

## 🚀 Start Testing in BAS

### 1. Start the Server
```bash
cds watch
```
**Wait for:** `server listening on { url: 'http://localhost:4004' }`

### 2. Access the Test UI
- BAS will show notification: **"A service is listening to port 4004"**
- Click **"Expose and Open"**
- You'll see the CAP Welcome Page

---

## 📋 Core Test Flow (3 Steps)

### Step A: Create Invitation
1. Click **InvitationService** → **generateInvitation**
2. Enter:
   - Email: `supplier@acme.com`
   - Name: `ACME Corp`
3. Click **Execute**
4. **Copy the token** from response (you'll need it!)

### Step B: Submit Supplier Data
1. Click **SupplierService** → **submitData**
2. Paste the token from Step A
3. Use this company data:
```json
{
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
```
4. Click **Execute**
5. You should see: `"success": true`

### Step C: Verify Invitation Used
1. Click **InvitationService** → **Invitations**
2. Click **Go**
3. Check that `status` is **"COMPLETED"** and `isUsed` is **true**

---

## ✅ Success Indicators

**Console Logs to Look For:**
```
[InvitationService] Generating invitation for supplier@acme.com
[InvitationService] Created invitation ID: ...
[SupplierService] Received supplier data submission
[SupplierService] Created supplier ID: ...
```

**No Errors:** If you see these logs with no error messages, everything works!

---

## 🔴 Common Error Scenarios (Should Work as Designed)

### 1. Duplicate Invitation
- Try creating same invitation twice → **409 Conflict** ✅
- Message: "Active invitation already exists"

### 2. Used Token
- Try submitting data twice with same token → **403 Forbidden** ✅
- Message: "Invitation token has already been used"

### 3. Invalid Email
- Email: `bad-email` → **400 Bad Request** ✅
- Message: "Invalid email format"

### 4. Missing Fields
- Submit without `taxID` → **400 Bad Request** ✅
- Message: "Field 'taxID' is required"

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `cds watch` fails | Run `npm install` first |
| Port 4004 in use | Run `pkill -f "cds watch"` then try again |
| Changes not reflected | Save all files (Ctrl+S), `cds watch` auto-reloads |
| Database locked | Delete `db.sqlite` and restart |

---

## 📊 Inspection Commands (Optional)

```bash
# View database tables
sqlite3 db.sqlite ".tables"

# View invitations
sqlite3 db.sqlite "SELECT ID, supplierEmail, status, isUsed FROM supplier_onboarding_Invitations;"

# View suppliers
sqlite3 db.sqlite "SELECT ID, companyName, s4hanaStatus FROM supplier_onboarding_Suppliers;"
```

---

## 📝 Report Back

After testing, reply with:

**If all works:**
```
✅ All tests passed
Ready for Step 5 (JWT Token Implementation)
```

**If issues found:**
```
❌ Issue encountered:
- Which test failed: [Test name]
- Error message: [Exact error]
- Console output: [Paste relevant logs]
```

---

## 📚 Full Details

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for comprehensive test scenarios (12 tests total)
