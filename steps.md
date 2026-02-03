# Supplier Self-Onboarding Solution – Implementation Steps

**Total Steps**: 28  
**Estimated Duration**: 3-5 days (depending on testing cycles)  
**Last Updated**: 2026-02-03

---

## Phase 1: Foundation & Security Design (Steps 1-7)

### Step 1 of 28 – Design security architecture & token lifecycle
- Define JWT token schema (claims, expiry, validation rules)
- Document authentication flows (internal users vs. external suppliers)
- Design token lifecycle state machine (CREATED → SENT → ACCESSED → SUBMITTED → CONSUMED/EXPIRED/REVOKED)
- Define XSUAA scopes and role templates
- Create security architecture documentation
- **Deliverables**: `docs/security-architecture.md`, initial `env/.env1` configuration

### Step 2 of 28 – Initialize CAP project structure
- Create CAP project with proper folder structure (`srv/`, `db/`, `app/`, `test/`, `scripts/`, `docs/`)
- Generate `package.json` with all required dependencies (@sap/cds, @sap/xssec, jsonwebtoken, aws-sdk, etc.)
- Create `.gitignore`, `README.md`, and project documentation
- Initialize `mta.yaml` for deployment
- Set up ESLint and testing framework (Jest)
- **Deliverables**: Complete project scaffold, `package.json`, `mta.yaml`, `README.md`

### Step 3 of 28 – Create XSUAA security descriptor (xs-security.json)
- Define application name (`supplier-onboarding`)
- Configure scopes: `supplier.onboard`, `invitation.create`, `invitation.manage`, `invitation.audit`
- Define role templates: Purchaser, Admin, Auditor
- Add role collections configuration
- Set tenant-mode and OAuth2 configuration
- **Deliverables**: `xs-security.json`
- **Test**: Validate JSON syntax, review scope naming conventions

### Step 4 of 28 – Design and implement CAP data model
- Create `db/schema.cds` with entities:
  - `SupplierInvitations` (invitation_id, token_hash, email, state, expiry, metadata)
  - `SupplierOnboardingData` (temp storage for form data before S/4HANA sync)
  - `AuditLog` (event tracking, security events)
  - `AttachmentMetadata` (file references, S3 object keys)
- Add associations, validations, annotations
- Define views for reporting
- **Deliverables**: `db/schema.cds`, `db/data/*.csv` (sample data for testing)
- **Test**: Run `cds deploy --to sqlite` and verify schema generation

### Step 5 of 28 – Create CAP service definitions (CDS)
- Create `srv/invitation-service.cds`:
  - Service `InvitationService` with entities exposed for CRUD
  - Actions: `createInvitation`, `validateToken`, `revokeInvitation`
  - Functions: `getInvitationStatus`, `generatePresignedUrl`
- Create `srv/supplier-service.cds`:
  - Service `SupplierDataService` for supplier form submissions
  - Actions: `submitSupplierData`, `uploadAttachment`
- Add authorization annotations (`@requires`, `@restrict`)
- **Deliverables**: `srv/invitation-service.cds`, `srv/supplier-service.cds`
- **Test**: Check CDS compile output, review service exposure

### Step 6 of 28 – Implement token generation logic (JavaScript)
- Create `srv/lib/token-manager.js`:
  - Function `generateInvitationToken(email, metadata)` → JWT with custom claims
  - Use RS256 algorithm, XSUAA key binding
  - Set expiry (7 days default, configurable)
  - Return token + invitation record
- Create utility `srv/lib/crypto-utils.js` for hashing, UUID generation
- Add comprehensive JSDoc comments
- **Deliverables**: `srv/lib/token-manager.js`, `srv/lib/crypto-utils.js`
- **Test**: Unit tests with sample inputs, console.log token payload, verify expiry calculation

### Step 7 of 28 – Implement token validation logic (JavaScript)
- Create `srv/lib/token-validator.js`:
  - Function `validateToken(token)` → decoded claims or error
  - Verify signature against XSUAA public key
  - Check expiry, audience, issuer
  - Query database for invitation status (not revoked, not consumed)
  - Implement rate limiting (track validation attempts)
- Add error codes and descriptive messages
- **Deliverables**: `srv/lib/token-validator.js`, `test/token-validator.test.js`
- **Test**: Test with expired token, invalid signature, revoked invitation, rate limit exceeded

---

## Phase 2: Backend Services & Integration (Steps 8-14)

### Step 8 of 28 – Implement invitation service handlers
- Create `srv/invitation-service.js`:
  - Handler for `createInvitation` → calls token-manager, inserts DB record, returns link
  - Handler for `validateToken` → calls token-validator, updates state to ACCESSED
  - Handler for `revokeInvitation` → sets state to REVOKED (admin only)
  - XSUAA middleware integration for role checks
- Add audit logging for all operations
- **Deliverables**: `srv/invitation-service.js`
- **Test**: Mock HTTP requests, verify DB state changes, test authorization (should fail without proper role)

### Step 9 of 28 – Implement supplier data service handlers
- Create `srv/supplier-service.js`:
  - Handler for `submitSupplierData` → validate token, store temp data, call S/4HANA API
  - Handler for form data CRUD (GET/PATCH for draft persistence)
  - Implement data validation (email format, tax ID patterns, IBAN validation)
- Add transaction handling (commit only if both S/4HANA + Object Store succeed)
- **Deliverables**: `srv/supplier-service.js`, `srv/lib/validators.js`
- **Test**: Submit sample supplier data, verify validation errors, check draft save/load

### Step 10 of 28 – Configure S/4HANA OData destination
- Create destination configuration document: `docs/destination-s4hana-setup.md`
- Define destination properties:
  - Name: `s4hana-cloud-odata-v4`
  - Type: HTTP
  - URL: `https://<tenant>.s4hana.cloud.sap/sap/opu/odata4/`
  - Authentication: OAuth2SAMLBearerAssertion (principal propagation)
  - ProxyType: Internet
  - Additional properties for CSRF token handling
- Provide BTP Cockpit step-by-step instructions
- **Deliverables**: `docs/destination-s4hana-setup.md`
- **Test**: Create destination, use "Check Connection", verify certificate trust

### Step 11 of 28 – Implement S/4HANA Business Partner integration
- Create `srv/lib/s4hana-client.js`:
  - Function `createBusinessPartner(data)` → calls A_BusinessPartner OData API
  - Function `createSupplier(businessPartnerId, data)` → calls A_Supplier API
  - Handle CSRF token fetch
  - Map internal data model to S/4HANA field structure
  - Error handling (OData error response parsing)
- Use `@sap-cloud-sdk/http-client` or `axios` with destination
- **Deliverables**: `srv/lib/s4hana-client.js`, `test/s4hana-client.test.js`
- **Test**: Mock OData responses, test error scenarios (400, 401, 500), verify field mapping

### Step 12 of 28 – Provision Object Store and create bucket
- Document Object Store setup: `docs/objectstore-setup.md`
- Create service instance via `cf create-service objectstore s3-standard supplier-onboarding-objectstore`
- Create service key for credentials extraction
- Create bucket `onboarding-documents` with lifecycle policy (90-day retention)
- Configure bucket CORS for Build Apps access
- **Deliverables**: `docs/objectstore-setup.md`, `scripts/setup-objectstore.sh`
- **Test**: Upload test file via AWS CLI, verify bucket exists, check CORS policy

### Step 13 of 28 – Configure Object Store destination
- Create destination: `objectstore-s3-endpoint`
- Extract S3 endpoint, access key, secret key from service binding
- Configure for S3-compatible protocol
- Add presigned URL configuration
- **Deliverables**: `docs/destination-objectstore-setup.md`
- **Test**: Test connection from BTP Cockpit

### Step 14 of 28 – Implement Object Store presigned URL generation
- Create `srv/lib/objectstore-client.js`:
  - Function `generatePresignedUploadUrl(fileName, contentType)` → S3 presigned PUT URL (15 min expiry)
  - Function `generatePresignedDownloadUrl(objectKey)` → S3 presigned GET URL (5 min expiry)
  - Function `listObjectsByInvitation(invitationId)` → query S3 objects
  - Use `aws-sdk` S3 client with custom endpoint
- Add object key naming convention: `{invitationId}/{timestamp}_{originalFileName}`
- **Deliverables**: `srv/lib/objectstore-client.js`, `test/objectstore-client.test.js`
- **Test**: Generate presigned URL, upload via curl/Postman, verify file in S3, test URL expiry

---

## Phase 3: Frontend - SAP Build Apps (Steps 15-21)

### Step 15 of 28 – Create SAP Build Apps project & initial setup
- Create new Build Apps project: `supplier-onboarding-app`
- Configure project settings (Horizon theme, responsive layout)
- Set up global variables:
  - `invitationToken` (from URL parameter)
  - `supplierEmail`, `companyName` (from token validation response)
  - `currentPage` (wizard navigation)
  - `formData` (object holding all form fields)
- Create data resources (REST API integrations)
- **Deliverables**: Build Apps project created, documented in `docs/buildapps-setup.md`
- **Test**: Open project, verify theme, check variable initialization

### Step 16 of 28 – Implement token validation page & error handling
- Create initial page: "Token Validation"
- On page mount:
  - Extract `token` from URL query parameter
  - Call CAP service `/validate-token?token={token}`
  - If valid → store supplier info, navigate to wizard
  - If invalid/expired → show error message with support contact
- Add loading spinner during validation
- Style error page per Fiori guidelines (MessageBox, friendly error text)
- **Deliverables**: Token validation flow in Build Apps
- **Test**: Access with valid token (should proceed), expired token (show error), no token (show error)

### Step 17 of 28 – Build wizard navigation structure (5 pages)
- Create 5 pages with wizard pattern:
  1. General Data (company info, address, legal form)
  2. Contact Persons (repeating section with Add/Remove)
  3. Payment & Bank Details (IBAN, SWIFT, bank name)
  4. Classification & Certifications (commodity codes, checkboxes)
  5. Attachments & Review (file upload, summary, submit)
- Add global wizard navigation component (stepper, previous/next buttons)
- Implement client-side validation per page (required fields, format checks)
- Disable "Next" button until current page is valid
- **Deliverables**: 5-page wizard structure, navigation logic
- **Test**: Navigate between pages, verify validation prevents navigation, check data persistence across pages

### Step 18 of 28 – Build Page 1 – General Supplier Data
- Fields:
  - Company Name (auto-filled from token, read-only)
  - Legal Form (dropdown: GmbH, AG, KG, Ltd, etc.)
  - Tax ID / VAT Number (input with format validation)
  - Commercial Register Number
  - Street, Postal Code, City, Country (dropdown)
  - Website (URL validation)
- Bind to `formData.generalData` object
- Add field-level validations with error messages
- **Deliverables**: Page 1 complete with all fields
- **Test**: Fill form, trigger validation errors, verify data stored in variable, test country dropdown population

### Step 19 of 28 – Build Page 2 – Contact Persons (repeating section)
- Repeating container for contacts (min 1, max 5)
- Fields per contact:
  - First Name, Last Name
  - Role (dropdown: Purchasing, Finance, Legal, Management)
  - Email (email validation)
  - Phone (phone format validation)
  - Primary Contact (radio button, only one can be primary)
- Add/Remove contact buttons
- Bind to `formData.contacts` array
- **Deliverables**: Page 2 with dynamic contact list
- **Test**: Add 3 contacts, remove one, validate emails, ensure one primary contact

### Step 20 of 28 – Build Page 3 – Payment & Bank Details
- Fields:
  - Bank Name
  - IBAN (IBAN format validation with country-specific rules)
  - SWIFT/BIC
  - Account Holder Name
  - Payment Terms (dropdown: 14 days, 30 days, 60 days, 90 days)
  - Currency (dropdown: EUR, USD, GBP)
- Add helper text explaining IBAN format
- Bind to `formData.bankDetails`
- **Deliverables**: Page 3 complete
- **Test**: Enter invalid IBAN (should fail), valid IBAN (should pass), test SWIFT validation

### Step 21 of 28 – Build Page 4 – Classification & Certifications
- Fields:
  - Commodity Codes (multi-select search, top 100 codes pre-loaded)
  - Certifications (checkboxes: ISO 9001, ISO 14001, ISO 45001, FSC, Fair Trade, etc.)
  - Customs number (if applicable)
  - Incoterms (dropdown: EXW, FCA, FOB, CIF, DDP, etc.)
- Bind to `formData.classification`
- **Deliverables**: Page 4 complete
- **Test**: Select multiple commodity codes, choose certifications, verify data binding

---

## Phase 4: File Upload & Form Submission (Steps 22-24)

### Step 22 of 28 – Build Page 5 – File Attachments & Final Review
- File upload section:
  - Upload component (PDF, JPG, PNG, max 5MB per file, max 10 files)
  - For each upload:
    1. Get presigned upload URL from CAP service
    2. Upload file directly to S3 using presigned URL
    3. Store object key in `formData.attachments` array
  - Display uploaded files with preview/download links (presigned GET URLs)
  - Allow file deletion before submission
- Review section:
  - Read-only summary of all form data (collapsible sections)
  - Edit buttons to jump back to specific pages
- Final submit button (disabled until all pages valid + at least 1 attachment)
- **Deliverables**: Page 5 with file upload and review
- **Test**: Upload PDF, verify in S3, delete file, verify removal, test 5MB limit, test unsupported file type

### Step 23 of 28 – Implement form submission flow
- On submit button click:
  1. Show loading overlay ("Submitting your data...")
  2. Call CAP service `POST /submitSupplierData` with full `formData` payload
  3. CAP service:
     - Creates Business Partner in S/4HANA
     - Creates Supplier record in S/4HANA
     - Links attachments to supplier record (store BP ID + attachment keys in DB)
     - Updates invitation status to CONSUMED
     - Logs audit event
  4. If success → navigate to success page
  5. If error → show error message with details, allow retry
- Add retry mechanism (max 3 attempts)
- **Deliverables**: Submission logic in Build Apps + CAP service endpoint
- **Test**: Submit valid form (should succeed), force S/4HANA error (should show error), test network timeout

### Step 24 of 28 – Create success & error pages
- Success page:
  - Green checkmark icon
  - "Thank you! Your registration has been submitted."
  - Display reference number (invitation ID or BP ID)
  - "You will be contacted by our team within 3 business days."
  - No navigation back (prevent resubmission)
- Error page:
  - Red error icon
  - Error message from API
  - Support contact information
  - Retry button (navigates back to review page)
- **Deliverables**: Success and error pages
- **Test**: Trigger both success and error scenarios

---

## Phase 5: Internal User Interface (Steps 25-26)

### Step 25 of 28 – Create internal key user UI (Build Apps or Fiori Elements)
- Create simple CRUD interface for purchasers to manage invitations
- Features:
  - List of all invitations (table with filters: status, date, email)
  - Create new invitation button → form with supplier email + company name
  - On create → calls CAP `/createInvitation` → displays shareable link
  - Copy link to clipboard button
  - Revoke invitation button (sets status to REVOKED)
  - View invitation details (status history, token metadata)
- Integrate with XSUAA (requires `invitation.create` scope)
- **Deliverables**: Internal UI in Build Apps or `app/invitations/` (Fiori Elements)
- **Test**: Login as purchaser, create invitation, copy link, revoke invitation

### Step 26 of 28 – Set up XSUAA role collections in BTP Cockpit
- Create role collections:
  - `supplier-onboarding-purchaser-rc` → assign `invitation.create` role
  - `supplier-onboarding-admin-rc` → assign `invitation.create`, `invitation.manage`, `invitation.audit` roles
  - `supplier-onboarding-auditor-rc` → assign `invitation.audit` role
- Assign role collections to test users
- Document in `docs/role-assignment-guide.md`
- **Deliverables**: Role collections configured, documentation
- **Test**: Login as purchaser (can create), login as auditor (can only view logs), test unauthorized access (should fail)

---

## Phase 6: Security Hardening & Testing (Steps 27-28)

### Step 27 of 28 – Implement security hardening
- Rate limiting:
  - Add Express middleware for rate limiting (per IP, per token)
  - Configuration via env variables
- CORS configuration:
  - Whitelist only Build Apps domain
- Input validation & sanitization:
  - SQL injection prevention (use parameterized queries)
  - XSS prevention (sanitize all inputs)
  - CSV injection prevention
- Security headers:
  - HSTS, X-Content-Type-Options, X-Frame-Options, CSP
- CSRF protection:
  - Implement double-submit cookie pattern or use CAP built-in
- Audit logging enhancements:
  - Log all security events (failed logins, invalid tokens, rate limit hits)
  - Integrate with BTP Audit Log Service
- **Deliverables**: `srv/middleware/security.js`, updated `srv/server.js`
- **Test**: Trigger rate limit, test CORS rejection, attempt XSS payload (should be sanitized), verify audit logs

### Step 28 of 28 – End-to-end testing & deployment preparation
- Create comprehensive test suite:
  - Unit tests for all utility functions (token-manager, validators, s4hana-client, etc.)
  - Integration tests for CAP services (invitation creation, validation, submission)
  - API tests (Postman collection or Newman)
  - UI tests (Build Apps manual test scenarios documented)
- Create deployment checklist: `docs/deployment-checklist.md`
  - BTP services provisioned
  - Destinations configured
  - Role collections assigned
  - Environment variables set
  - Build Apps published
  - CAP service deployed
- Create runbook: `docs/runbook.md`
  - Monitoring dashboards
  - Common issues & resolution steps
  - Rollback procedure
  - Contact escalation matrix
- **Deliverables**: Test suite, deployment checklist, runbook
- **Test**: Execute full test suite, perform end-to-end smoke test (internal user creates invitation → supplier fills form → data appears in S/4HANA)

---

## Success Criteria

✅ Internal purchaser can generate invitation link via UI  
✅ Supplier receives link, accesses form, sees Fiori Horizon theme  
✅ Token validation prevents access with expired/invalid tokens  
✅ Supplier can fill 5-page wizard, upload attachments  
✅ Form data creates Business Partner + Supplier in S/4HANA via OData API  
✅ Attachments stored securely in Object Store with presigned URLs  
✅ Audit log records all operations  
✅ Role-based access control enforced (purchaser, admin, auditor)  
✅ Security hardening in place (rate limiting, CORS, input validation, CSRF)  
✅ All tests pass, deployment successful

---

**End of Implementation Plan**
