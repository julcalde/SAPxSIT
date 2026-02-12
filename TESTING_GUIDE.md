# Testing Guide - Unified Supplier Management System v1.0.0

This guide provides comprehensive testing routes for all features of the Unified Supplier Management System.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Frontend Testing - Supplier Route](#frontend-testing---supplier-route)
3. [Frontend Testing - Admin Route](#frontend-testing---admin-route)
4. [Backend API Testing](#backend-api-testing)
5. [Security Testing](#security-testing)
6. [Email Testing](#email-testing)

---

## Prerequisites

### Start the Server

```bash
cd /home/julcalde/Desktop/SAPxSIT
npx cds watch
```

Server should start on: **http://localhost:4004**

### Test Accounts

You'll create test data during testing. Keep track of:
- Supplier email addresses
- 4-digit PINs (shown only once!)
- Verification tokens/URLs

---

## 🛍️ Frontend Testing - Supplier Route

**Scenario**: Supplier receives verification link, validates authenticity, enters PIN, and confirms delivery.

### Step 1: Receive Verification Link

**Note**: This step is performed by admin. Skip to Step 2 if you already have a verification link.

1. Open Admin Panel: http://localhost:4004/admin/index.html
2. Create a supplier (see Admin Route, Step 1)
3. Create an order for that supplier (see Admin Route, Step 2)
4. Copy the verification URL from the response

**Example URL**:
```
http://localhost:4004/service/verify/verifyAndRedirect?token=abc123...&redirect=/external/index.html
```

### Step 2: Verify Link Authenticity (Anti-Phishing)

**URL**: http://localhost:4004/verify-link/index.html

**Test Cases**:

#### ✅ Test 2.1: Verify Legitimate Link
1. Open anti-phishing page
2. Paste the verification URL in the input field
3. Click **"🔍 Verify Link"**

**Expected Results**:
- ✅ Green "safe" status box appears
- Message: "This is a legitimate verification link from our system"
- Shows order number (or "N/A" if not set)
- Shows supplier name (or "N/A" if not populated)
- Shows expiration time (e.g., "expires in 42 hours")
- Order details displayed (if available)

#### ❌ Test 2.2: Verify Invalid Token
1. Open anti-phishing page
2. Enter an invalid token: `invalidtoken123`
3. Click **"🔍 Verify Link"**

**Expected Results**:
- ❌ Red "danger" status box
- Message: "Invalid token format. Please check the link."

#### ⚠️ Test 2.3: Verify Expired Token
1. Create an order with 0.01 hours expiration
2. Wait 1 minute
3. Verify the token

**Expected Results**:
- ⚠️ Yellow "warning" status
- Message indicates token has expired

### Step 3: Access PIN Verification Page

1. Click the verification link (or paste URL in browser)
2. You should be redirected to: `/pin/index.html?token=...`

**Visual Verification**:
- Modern blue gradient background
- Shield icon (🛡️)
- "Enter Your PIN" heading
- 4 input boxes for PIN digits
- Attempt counter (e.g., "Attempt 1 of 3")

### Step 4: Enter 4-Digit PIN

#### ✅ Test 4.1: Correct PIN
1. Enter the correct 4-digit PIN (from supplier creation)
2. Form auto-submits when 4th digit entered

**Expected Results**:
- Success message briefly displayed
- Automatic redirect to `/external/index.html`
- Order details page loads
- No need to enter PIN again (24h session)

#### ❌ Test 4.2: Incorrect PIN (First Attempt)
1. Enter wrong PIN: `0000`
2. Wait for response

**Expected Results**:
- Red error message: "Incorrect PIN. 2 attempt(s) remaining."
- Input fields cleared
- Attempt counter updates to "Attempt 2 of 3"
- Can try again

#### ❌ Test 4.3: Multiple Failed Attempts
1. Enter wrong PIN: `1111`
2. Enter wrong PIN: `2222`
3. Enter wrong PIN: `3333`

**Expected Results**:
- After 3rd failure: "Token has been locked due to too many failed attempts."
- Red error message
- Input fields disabled
- Cannot access order anymore
- Admin must generate new token

#### ⚠️ Test 4.4: Invalid PIN Format
1. Enter only 3 digits
2. Try to submit

**Expected Results**:
- Form doesn't submit (4 digits required)
- No error message yet

### Step 5: View Order Details

**URL**: http://localhost:4004/external/index.html (auto-redirected after PIN)

**Visual Verification**:
- Order information card with:
  - Order Number
  - Description (if set)
  - Total Amount (if set)
  - Delivery Date (if confirmed)
  - Status badge
- Documents section
- Delivery confirmation section

### Step 6: Upload Document

1. Click **"Choose File"** button
2. Select a test file (PDF, image, etc.)
3. Select **Document Type** from dropdown:
   - Invoice
   - Delivery Note
   - Quality Certificate
   - Receipt
   - Other
4. Enter **Description**: "Test invoice upload"
5. Click **"Upload Document"**

**Expected Results**:
- Success message: "Document uploaded successfully"
- Document appears in documents list with:
  - File name
  - Document type badge
  - Upload date
  - Status: "Pending"
  - Download button

**⚠️ Note**: If you get 415 error, this is a known issue with multipart form handling.

### Step 7: Download Document

1. Locate uploaded document in list
2. Click **"Download"** button

**Expected Results**:
- File downloads to your browser
- File opens correctly
- Same content as uploaded file

### Step 8: Confirm Delivery

1. Scroll to **"Confirm Delivery"** section
2. Select **Delivery Date** (e.g., today's date)
3. Enter **Delivery Notes**: "All items delivered in good condition. Signed by John Doe."
4. Click **"Confirm Delivery"**

**Expected Results**:
- Success message: "Delivery confirmed successfully"
- Order status updates to "Delivered"
- Delivery date and notes displayed
- Section becomes read-only
- **Admin receives email notification** (check console for Ethereal preview URL)

### Step 9: Session Persistence Test

1. Refresh the page (F5)
2. Close tab and reopen: http://localhost:4004/external/index.html

**Expected Results**:
- Still logged in (no PIN prompt)
- Order details still visible
- Session valid for 24 hours
- HttpOnly cookie maintains authentication

### Step 10: Session Expiration Test

**Note**: This requires waiting 24 hours or manually invalidating the token.

1. After 24 hours, try to access: http://localhost:4004/external/index.html

**Expected Results**:
- Redirected to error or login page
- Session expired
- Need new verification link to access

---

## 👨‍💼 Frontend Testing - Admin Route

**Scenario**: Admin creates supplier, generates order with token, manages documents, and monitors system.

### Step 1: Create Supplier

**URL**: http://localhost:4004/admin/index.html

1. Navigate to **"Suppliers"** tab
2. Click **"Create New Supplier"** button
3. Fill in form:
   - **Name**: "Test Supplier Inc."
   - **Email**: "test@supplier.com"
4. Click **"Create Supplier"**

**Expected Results**:
- Success message with supplier ID (e.g., "SUP-5E219310")
- **⚠️ CRITICAL**: 4-digit PIN displayed prominently
  - Example: "PIN: **1234**"
  - Warning message: "Save this PIN now - it won't be shown again!"
  - Red border around PIN display
- **IMMEDIATELY SAVE THE PIN** (write it down or copy)
- Supplier appears in suppliers list
- Supplier ID auto-generated format: `SUP-XXXXXXXX`

**Visual Verification**:
- New supplier row in table
- Supplier name and email displayed
- Active status badge (green)

### Step 2: Create Order & Generate Token

1. Navigate to **"Orders"** tab
2. Click **"Create New Order"** button
3. Fill in form:
   - **Supplier**: Select from dropdown (e.g., "Test Supplier Inc.")
   - **Order Number**: "ORD-2026-001"
   - **Description**: "Test order for supplier portal access"
   - **Total Amount**: 2500.50
   - **Expiration Hours**: 48 (2 days)
4. Click **"Generate Secure Link"**

**Expected Results**:
- Success message
- Response shows:
  - Order ID (UUID)
  - Token (64-character hex)
  - Verification URL (full URL with token)
  - Note about PIN: "Supplier already has a PIN set."
- Order appears in orders table
- Copy verification URL for testing

**Example Response**:
```json
{
  "orderId": "abc-123-def-456",
  "token": "64charHexString...",
  "verifyUrl": "http://localhost:4004/service/verify/verifyAndRedirect?token=...",
  "supplierPin": "****",
  "note": "Supplier already has a PIN set."
}
```

### Step 3: Send Verification Email

**Option A: Send Email Immediately**
1. After creating order, click **"Send Email"** button in success modal

**Option B: Send Email Later**
1. Navigate to **"Orders"** tab
2. Find the order in the list
3. Click **"Send Email"** button in actions column

**Expected Results**:
- Success message: "Email sent successfully to test@supplier.com"
- Check **terminal console** for Ethereal preview URL:
  ```
  [EmailService] 📧 Preview URL: https://ethereal.email/message/xxxxx
  ```
- Open preview URL in browser to see email
- Email contains:
  - Supplier name
  - Order number
  - Verification button/link
  - Expiration date/time
  - Styled HTML with CSS

### Step 4: View Order List

1. Navigate to **"Orders"** tab
2. Review orders table

**Visual Verification**:
- Each order row shows:
  - Order Number
  - Supplier Name (expandable)
  - Description
  - Total Amount
  - Status badge (color-coded)
  - Delivery Date (if confirmed)
  - Action buttons

**Filter Tests**:
- Search by order number
- Search by supplier name
- Sort by date, amount, status

### Step 5: View Documents

1. Navigate to **"Documents"** tab
2. Review all uploaded documents

**Expected Data**:
- File name
- Document type badge
- Order number
- Status badge (Pending/Approved/Rejected)
- Upload date
- Admin feedback (if provided)
- Action buttons (Download, Delete, Update Status)

### Step 6: Download Document

1. Locate a document in list
2. Click **"Download"** button

**Expected Results**:
- File downloads immediately
- File opens correctly
- Original content preserved

### Step 7: Update Document Status

1. Locate a "Pending" document
2. Click **"Update Status"** or edit icon
3. Select new status: **"Approved"**
4. Enter **Admin Feedback**: "Invoice verified and approved"
5. Save changes

**Expected Results**:
- Status badge updates to "Approved" (green)
- Admin feedback displayed
- Timestamp updated

### Step 8: Delete Document

1. Locate a document
2. Click **"Delete"** button
3. Confirm deletion in modal

**Expected Results**:
- Confirmation prompt
- Document removed from list
- Success message

### Step 9: Archive Supplier

1. Navigate to **"Suppliers"** tab
2. Locate a supplier with **no active orders**
3. Click **"Archive"** button
4. Confirm in modal

**Expected Results**:
- Supplier marked as archived
- Row becomes dimmed/grayed out
- "Archived" badge appears
- archivedAt timestamp set
- archivedBy set to current user

**Error Test**: Try to archive supplier with active orders
- Error message: "Cannot archive supplier with active orders"

### Step 10: Restore Supplier

1. Check **"Show Archived"** checkbox
2. Locate archived supplier
3. Click **"Restore"** button

**Expected Results**:
- Supplier marked as active
- Row returns to normal styling
- "Active" badge appears
- archivedAt cleared

### Step 11: Cancel Order

1. Navigate to **"Orders"** tab
2. Locate an order to cancel
3. Click **"Cancel"** button
4. Enter **Cancellation Reason**: "Supplier requested cancellation"
5. Confirm

**Expected Results**:
- Order status changes to "Cancelled"
- Cancellation reason stored
- Associated tokens automatically revoked
- cancelledAt timestamp set
- cancelledBy set to current user

### Step 12: Restore Order

1. Check **"Show Cancelled"** checkbox
2. Locate cancelled order
3. Click **"Restore"** button

**Expected Results**:
- Order status changes back to previous state
- Cancellation data cleared
- Tokens remain revoked (admin must generate new token)

---

## 🔌 Backend API Testing

**For features not fully testable via frontend or requiring direct API validation.**

### Setup

```bash
# Ensure server is running
npx cds watch

# Test from terminal
BASE_URL="http://localhost:4004"
```

### Test 1: Create Supplier (with PIN)

```bash
curl -X POST $BASE_URL/service/internal/createSupplier \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Supplier",
    "email": "apitest@supplier.com"
  }' | jq '.'
```

**Expected Response**:
```json
{
  "@odata.context": "$metadata#Suppliers/$entity",
  "ID": "uuid",
  "supplierID": "SUP-XXXXXXXX",
  "name": "API Test Supplier",
  "email": "apitest@supplier.com",
  "pinHash": "hash-string",
  "pin": "1234"
}
```

**Validation**:
- ✅ `supplierID` follows format `SUP-XXXXXXXX`
- ✅ `pin` is 4 digits
- ✅ `pinHash` is present (SHA-256)
- ✅ Supplier appears in database

### Test 2: Create Order with Token

**Save Supplier ID from previous test**:
```bash
SUPPLIER_ID="paste-supplier-id-here"

curl -X POST $BASE_URL/service/internal/createOrderAndToken \
  -H "Content-Type: application/json" \
  -d "{\"supplierId\": \"$SUPPLIER_ID\"}" | jq '.'
```

**Expected Response**:
```json
{
  "orderId": "uuid",
  "token": "64-char-hex-string",
  "verifyUrl": "http://localhost:4004/service/verify/verifyAndRedirect?token=...",
  "supplierPin": "****",
  "note": "Supplier already has a PIN set."
}
```

**Validation**:
- ✅ `token` is 64 characters
- ✅ `token` contains only hex characters [0-9a-f]
- ✅ `verifyUrl` is properly formatted
- ✅ Order created in database

### Test 3: Check Link Authenticity (Public Endpoint)

```bash
TOKEN="paste-token-from-test2"

curl -X POST $BASE_URL/service/verify/checkLinkAuthenticity \
  -H "Content-Type: application/json" \
  -d "{\"urlOrToken\": \"$TOKEN\"}" | jq '.'
```

**Expected Response**:
```json
{
  "isValid": true,
  "isExpired": false,
  "isRevoked": false,
  "isUsed": false,
  "expiresAt": "2026-02-14T...",
  "orderNumber": "N/A",
  "supplierName": "N/A",
  "message": "✅ This is a legitimate verification link...",
  "warningLevel": "safe"
}
```

**Validation**:
- ✅ `isValid` is true
- ✅ `warningLevel` is "safe" (green)
- ✅ No authentication required (public endpoint)

### Test 4: Verify PIN (Correct)

```bash
TOKEN="paste-token-from-test2"
PIN="paste-pin-from-test1"

curl -X POST $BASE_URL/service/verify/verifyPin \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\", \"pin\": \"$PIN\"}" | jq '.'
```

**Expected Response**:
```json
{
  "success": true,
  "orderID": "uuid",
  "sessionToken": "jwt-token-string",
  "expiresIn": 86400,
  "message": "Authentication successful"
}
```

**Validation**:
- ✅ `success` is true
- ✅ `sessionToken` is JWT format (3 parts separated by dots)
- ✅ `expiresIn` is 86400 (24 hours in seconds)

### Test 5: Verify PIN (Incorrect)

```bash
TOKEN="paste-new-token"  # Create new order first!

curl -X POST $BASE_URL/service/verify/verifyPin \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\", \"pin\": \"0000\"}" | jq '.'
```

**Expected Response** (1st attempt):
```json
{
  "error": {
    "message": "Incorrect PIN. 2 attempt(s) remaining.",
    "code": "401"
  }
}
```

**Validation**:
- ✅ Error message shows remaining attempts
- ✅ Status code 401
- ✅ `pinAttempts` incremented in database

### Test 6: Access External Order (with Session)

```bash
SESSION_TOKEN="paste-from-test4"

curl $BASE_URL/service/external/Order \
  -H "Cookie: external_session=$SESSION_TOKEN" | jq '.'
```

**Expected Response**:
```json
{
  "orderNumber": "...",
  "description": "...",
  "totalAmount": 2500.50,
  "status": "...",
  "deliveryDate": null
}
```

**Validation**:
- ✅ Order data returned
- ✅ Cookie-based authentication working
- ✅ No 401 error

### Test 7: Confirm Delivery

```bash
SESSION_TOKEN="paste-session-token"

curl -X POST $BASE_URL/service/external/confirmDelivery \
  -H "Content-Type: application/json" \
  -H "Cookie: external_session=$SESSION_TOKEN" \
  -d '{
    "deliveryDate": "2026-02-12",
    "notes": "API test delivery confirmation"
  }' | jq '.'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Delivery confirmed successfully"
}
```

**Validation**:
- ✅ `success` is true
- ✅ Order status updated in database
- ✅ Admin notification email sent (check console)

### Test 8: Send Verification Email

```bash
ORDER_ID="paste-order-id"

curl -X POST $BASE_URL/service/internal/sendVerificationEmail \
  -H "Content-Type: application/json" \
  -d "{\"orderID\": \"$ORDER_ID\"}" | jq '.'
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Email sent successfully to email@address.com",
  "verifyUrl": "http://localhost:4004/service/verify/..."
}
```

**Check Terminal Console**:
```
[EmailService] ✅ Ethereal test account created: (first time only)
   Email: xxxxx@ethereal.email
   Password: xxxxx

[EmailService] 📧 Preview URL: https://ethereal.email/message/xxxxx
```

**Validation**:
- ✅ Success message
- ✅ Preview URL logged to console
- ✅ Open preview URL to see email
- ✅ Email contains verification link and order details

---

## 🔒 Security Testing

### Test 1: Token Format Validation

**Invalid Token Formats**:
```bash
# Too short (should be 64 chars)
curl -X POST $BASE_URL/service/verify/checkLinkAuthenticity \
  -H "Content-Type: application/json" \
  -d '{"urlOrToken": "short"}' | jq '.warningLevel'
# Expected: "danger"

# Non-hex characters
curl -X POST $BASE_URL/service/verify/checkLinkAuthenticity \
  -H "Content-Type: application/json" \
  -d '{"urlOrToken": "zzzz1234567890123456789012345678901234567890123456789012345678"}' | jq '.warningLevel'
# Expected: "danger"
```

### Test 2: PIN Attempt Limiting

1. Create new order with token
2. Attempt wrong PIN 3 times
3. Try 4th attempt

**Expected**: Token locked, cannot try again

### Test 3: Token Expiration

1. Create order with `expiresInHours: 0.01` (36 seconds)
2. Wait 1 minute
3. Try to verify token

**Expected**: Token expired, warning level "warning"

### Test 4: Session Cookie Security

Check browser DevTools → Application → Cookies:

**Validation**:
- ✅ Cookie name: `external_session`
- ✅ HttpOnly: `true` (not accessible via JavaScript)
- ✅ SameSite: `Lax`
- ✅ Max-Age: 86400 (24 hours)
- ✅ Secure: `false` (dev), `true` (production)

### Test 5: JWT Token Validation

Decode session token at https://jwt.io

**Expected Payload**:
```json
{
  "orderID": "uuid",
  "tokenID": "uuid",
  "type": "external-access",
  "iat": 1234567890,
  "exp": 1234567890
}
```

**Validation**:
- ✅ Contains orderID
- ✅ Expiration set correctly (24h from issue)
- ✅ Signed with JWT_SECRET

---

## 📧 Email Testing

### Test 1: Ethereal Email Setup

**Check Server Startup Logs**:

Look for:
```
[EmailService] ✅ Ethereal test account created:
   Email: example@ethereal.email
   Password: password123
```

**Validation**:
- ✅ Ethereal account auto-created if no SMTP configured
- ✅ Credentials logged to console
- ✅ Can manually login to Ethereal.email to check inbox

### Test 2: Verification Email

1. Create supplier and order (as per Admin Route)
2. Send verification email
3. Check console for preview URL

**Open Preview URL**: https://ethereal.email/message/xxxxx

**Email Content Validation**:
- ✅ Subject: "Order Verification Required - {orderNumber}"
- ✅ Contains supplier name
- ✅ Contains order number
- ✅ Verification button/link present
- ✅ Expiration date/time shown
- ✅ Styled with CSS (colors, formatting)
- ✅ Link clickable and correct

### Test 3: Admin Notification Email

1. Supplier confirms delivery (as per Supplier Route, Step 8)
2. Check console for preview URL

**Open Preview URL**:

**Email Content Validation**:
- ✅ Subject: "✅ Delivery Confirmed - Order {orderNumber}"
- ✅ Contains order number
- ✅ Contains delivery date
- ✅ Contains delivery notes
- ✅ Contains confirmation timestamp
- ✅ Styled HTML format

### Test 4: Real SMTP (Optional)

**Gmail Configuration**:

1. Update `.env`:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ADMIN_EMAIL=admin@company.com
   ```

2. Restart server
3. Send verification email
4. **Check real email inbox**

**Validation**:
- ✅ Email received in inbox
- ✅ Not in spam folder
- ✅ All content renders correctly
- ✅ Links work when clicked

---

## ✅ Testing Checklist

### Frontend - Supplier

- [ ] Anti-phishing page verifies legitimate link
- [ ] Anti-phishing page rejects invalid token
- [ ] PIN page accepts correct PIN
- [ ] PIN page rejects incorrect PIN (3 attempts)
- [ ] PIN page locks after 3 failures
- [ ] Order details page loads after PIN
- [ ] Document upload works
- [ ] Document download works
- [ ] Delivery confirmation works
- [ ] Session persists after refresh

### Frontend - Admin

- [ ] Create supplier with PIN displayed
- [ ] Create order with token generated
- [ ] Send verification email works
- [ ] View orders list with supplier info
- [ ] View documents list
- [ ] Download document works
- [ ] Update document status works
- [ ] Delete document works
- [ ] Archive/restore supplier works
- [ ] Cancel/restore order works

### Backend API

- [ ] Create supplier returns PIN
- [ ] Create order returns valid token
- [ ] Check link authenticity works (public)
- [ ] Verify correct PIN returns session token
- [ ] Verify incorrect PIN returns error
- [ ] Access order with session cookie works
- [ ] Confirm delivery works
- [ ] Send verification email works

### Security

- [ ] Token format validated
- [ ] PIN attempts limited to 3
- [ ] Token expiration enforced
- [ ] Session cookie HttpOnly
- [ ] JWT token properly signed
- [ ] Unauthorized access blocked

### Email

- [ ] Ethereal account created
- [ ] Verification email sent
- [ ] Admin notification sent
- [ ] Preview URLs work
- [ ] Email content correct

---

## 🐛 Known Issues

1. **Document Upload 415 Error**: Multipart form-data handling needs fix
   - **Workaround**: Use backend API or fix content-type handling

2. **Order Details Not Showing**: Some fields may be null
   - **Cause**: Optional fields not set during order creation
   - **Fix**: Populate description, totalAmount when creating order

---

## 📊 Test Results Log Template

```
Test Date: ___________
Tester: ___________
Server URL: http://localhost:4004

[ ] Frontend - Supplier (10 tests)
[ ] Frontend - Admin (12 tests)
[ ] Backend API (8 tests)
[ ] Security (5 tests)
[ ] Email (4 tests)

Issues Found:
1. _____________________
2. _____________________

Notes:
_________________________
```

---

**Happy Testing! 🎉**

For questions or issues, refer to [README.md](README.md) or create an issue in the repository.
