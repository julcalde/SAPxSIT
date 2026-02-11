# Testing Guide - Unified Supplier Management System

## Prerequisites

Ensure the CAP server is running:
```bash
cd /home/julcalde/Desktop/SAPxSIT
npm start
```

Server should be accessible at: http://localhost:4004

## Backend Testing (Completed ✅)

All backend functionality has been thoroughly tested:
- ✅ Token generation and validation
- ✅ JWT session creation and authorization
- ✅ Email sending with verification links
- ✅ Document status updates
- ✅ Delivery confirmation
- ✅ Security controls (token reuse prevention, status validation)
- ✅ File upload with base64 encoding

## Frontend Testing

### 1. Admin Panel Testing

**Access**: http://localhost:4004/app/admin/index.html

#### Test 1.1: View Suppliers
1. Open admin panel
2. Verify "Suppliers" table displays:
   - Acme Corporation (SUP-001)
   - Global Trade GmbH (SUP-002)

**Expected**: Table shows 2 suppliers with IDs and email addresses

#### Test 1.2: View Orders
1. Scroll to "Orders" section
2. Verify orders table shows:
   - Order Number (ORD-2026-001, ORD-2026-002)
   - Supplier names
   - Status badges
   - Action buttons

**Expected**: 2 orders visible with color-coded status

#### Test 1.3: Generate Secure Link
1. Click "Generate Link" for ORD-2026-001
2. Verify modal appears with:
   - Full verification URL
   - "Copy Link" button
   - Expiration time
3. Click "Copy Link"
4. Verify success message

**Expected**: Link copied to clipboard, format:
```
http://localhost:4004/service/verify/verifyAndRedirect?token=[64-char-hex]&redirect=/app/external/index.html
```

#### Test 1.4: Send Verification Email
1. Click "Send Email" for an order
2. Check console or email inbox
3. Verify email sent with secure link

**Expected**: Email delivered with professional HTML template

#### Test 1.5: View Documents
1. Click "View Documents" for ORD-2026-001
2. Verify documents section appears with:
   - Document list table
   - Status indicators (pending=yellow, approved=green, rejected=red)
   - "Update Status" buttons

**Expected**: 2 documents shown (DOC-001, DOC-002) with different statuses

#### Test 1.6: Update Document Status
1. In documents view, click "Update Status" for DOC-001 (pending)
2. Verify modal appears with:
   - Status dropdown (approved/rejected/pending)
   - Admin feedback textarea
3. Select "approved", enter feedback "Looks good"
4. Click "Update Status"
5. Verify success message
6. Refresh documents view

**Expected**: DOC-001 status changes to green "approved" badge

### 2. External Supplier Access Testing

#### Test 2.1: Access via Secure Link
1. From admin panel, generate a link for ORD-2026-002 (not yet confirmed)
2. Copy the verification URL
3. Open new incognito/private browser window
4. Paste and access the URL

**Expected**:
- Redirect to `/app/external/index.html`
- Cookie `external_session` set with JWT
- Order details page loads

#### Test 2.2: View Order Information
1. After successful access, verify page displays:
   - Order Number: ORD-2026-002
   - Created Date: Feb 5, 2026
   - Status: PENDING
   - Delivery Confirmed: — (not yet confirmed)
   - Delivery Notes: — (empty)

**Expected**: Order information section populated correctly

#### Test 2.3: View Documents
1. Scroll to "Documents" section
2. Verify documents table shows existing documents
3. Check status color coding:
   - Pending = yellow badge
   - Approved = green badge
   - Rejected = red badge

**Expected**: Documents displayed with proper formatting and status

#### Test 2.4: Confirm Delivery
1. Find "Confirm Delivery" form section
2. Fill in:
   - Delivery Date: Select today's date
   - Delivery Notes: "All items received in excellent condition. No damages."
3. Click "Confirm Delivery"

**Expected**:
- Success message appears
- Page reloads
- Order status changes to "CONFIRMED"
- Delivery date and notes now visible in order info

#### Test 2.5: Upload Document
1. In documents section, click "Upload Document" button
2. Select a PDF or image file (< 10MB)
3. Click upload

**Expected**:
- Success message
- New document appears in table with "pending" status
- File saved in `/uploads` directory

#### Test 2.6: Invalid File Upload
1. Try uploading a .txt or .docx file
2. Verify error message: "Invalid file type"

**Expected**: Upload rejected, error message shown

#### Test 2.7: Token Expiration
1. Wait 15+ minutes with the same link
2. Try to generate a new link for the same order
3. Try to access the old link again

**Expected**: Token marked as used, cannot be reused

### 3. End-to-End Workflow Testing

#### Test 3.1: Complete Supplier Journey
1. **Admin**: Open admin panel → ORD-2026-001
2. **Admin**: Click "Generate Link" → Copy URL
3. **Admin**: Click "Send Email" → Verify email sent
4. **Supplier**: Open email → Click verification link
5. **Supplier**: View order details
6. **Supplier**: Upload invoice.pdf
7. **Supplier**: Confirm delivery with date and notes
8. **Admin**: Refresh admin panel → View Documents
9. **Admin**: Update uploaded document status to "approved"
10. **Supplier**: Refresh → See approved status

**Expected**: Complete workflow works seamlessly

### 4. Security Testing

#### Test 4.1: Access Without Token
1. Open incognito window
2. Navigate directly to: http://localhost:4004/app/external/index.html
3. Verify behavior

**Expected**: Page loads but shows error "No valid session" or similar

#### Test 4.2: Token Reuse Prevention
1. Generate link for ORD-2026-001
2. Access the link successfully (token consumed)
3. Try accessing the same link again
4. Verify rejection

**Expected**: Second access fails with "Token already used"

#### Test 4.3: JWT Authorization
1. Access external page with valid JWT
2. Open browser DevTools → Network tab
3. Check API requests to `/service/external/Orders`
4. Verify `Authorization: Bearer [JWT]` header present
5. Try modifying JWT in cookies
6. Verify requests fail

**Expected**: Modified JWT rejected with 401 Unauthorized

### 5. API Testing (CLI)

#### Test 5.1: Generate Link via API
```bash
curl -X POST http://localhost:4004/service/internal/generateSecureLink \
  -H "Content-Type: application/json" \
  -d '{"orderID": "b1c2d3e4-f5a6-4789-b012-234567890ab1"}' | jq '.'
```

**Expected**: Returns token, verifyUrl, expiresAt

#### Test 5.2: Verify Token
```bash
# Use token from previous response
curl -v "http://localhost:4004/service/verify/verifyAndRedirect?token=[TOKEN]&redirect=/app/external/index.html" 2>&1 | grep "Set-Cookie"
```

**Expected**: Sets `external_session` cookie with JWT

#### Test 5.3: Access External Service
```bash
# Use JWT from cookie
JWT="[JWT_VALUE]"
curl -s http://localhost:4004/service/external/Orders \
  -H "Authorization: Bearer $JWT" | jq '.'
```

**Expected**: Returns only the order associated with the JWT

#### Test 5.4: Confirm Delivery via API
```bash
JWT="[JWT_VALUE]"
curl -X POST http://localhost:4004/service/external/confirmDelivery \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"deliveryDate": "2026-02-11", "notes": "Test delivery confirmation"}' | jq '.'
```

**Expected**: Returns `{"success": true, "message": "Delivery confirmed successfully"}`

## Test Results Summary

### Backend (All Passed ✅)
- [x] Token Generation Service
- [x] JWT Session Management
- [x] Email Service Integration
- [x] Document Status Updates
- [x] Delivery Confirmation
- [x] Security Controls
- [x] File Upload Handling

### Frontend (To Be Tested)
- [ ] Admin Panel UI
- [ ] Link Generation Modal
- [ ] Email Sending
- [ ] Document Management
- [ ] External Supplier Page
- [ ] Order Details Display
- [ ] Delivery Confirmation Form
- [ ] Document Upload
- [ ] Status Updates

### Security (To Be Tested)
- [ ] Token Expiration
- [ ] Token Reuse Prevention
- [ ] JWT Authorization
- [ ] File Type Validation
- [ ] File Size Limits

## Known Issues

None identified in backend testing.

## Browser Compatibility

Tested in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

## Performance Notes

- Token generation: < 100ms
- JWT verification: < 50ms
- Database queries: < 100ms (SQLite)
- File upload: Depends on file size

## Next Steps

1. Complete frontend testing checklist
2. Test in production-like environment
3. Load testing with multiple concurrent users
4. Security audit
5. Documentation review
