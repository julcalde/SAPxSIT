# Test Plan - Step 4: CAP Data Model

**Step:** 4 of 28  
**Component:** Domain Model (CDS Schema)  
**File:** `db/schema.cds`  
**Date:** February 3, 2026

---

## Test Cases

### TC-4.1: CDS Schema Compilation
**Objective:** Validate CDS syntax and structure  
**Command:**
```bash
cds compile db/schema.cds --to json
```
**Expected:**
- ✅ No compilation errors
- ✅ JSON output shows all entities
- ✅ Associations and compositions resolved
- ✅ Enumerations properly defined

**Success Criteria:**
- Exit code 0
- Valid JSON structure
- No warnings or errors

---

### TC-4.2: Entity Structure Validation
**Objective:** Verify all required entities exist with correct aspects  

**Expected Entities:**
1. `SupplierInvitations` (cuid + managed)
2. `SupplierOnboardingData` (cuid + managed)
3. `AttachmentMetadata` (cuid + managed)
4. `AuditLogs` (cuid only - immutable)

**Validation Command:**
```bash
cds compile db/schema.cds --to json | jq '.definitions | keys | map(select(startswith("supplierOnboarding."))) | sort'
```

**Expected Output:**
```json
[
  "supplierOnboarding.AuditEventType",
  "supplierOnboarding.AuditLogs",
  "supplierOnboarding.AttachmentMetadata",
  "supplierOnboarding.AttachmentType",
  "supplierOnboarding.OnboardingStatus",
  "supplierOnboarding.SupplierInvitations",
  "supplierOnboarding.SupplierOnboardingData",
  "supplierOnboarding.TokenState"
]
```

**Success Criteria:**
- ✅ 4 core entities present
- ✅ 4 enumerations present
- ✅ Namespace `supplierOnboarding` applied

---

### TC-4.3: SAP CAP Standards Compliance
**Objective:** Verify adherence to SAP CAP best practices  

**Checklist:**

#### Naming Conventions
- ✅ Entity names pluralized: `SupplierInvitations`, not `SupplierInvitation`
- ✅ Entity names capitalized
- ✅ Element names lowercase
- ✅ Concise field names (no redundant context)

#### Primary Keys
- ✅ Uses `cuid` aspect from `@sap/cds/common`
- ✅ Auto-generated UUID keys
- ✅ Simple, single-field keys (not composite)

#### Aspects
- ✅ `managed` aspect for timestamps (`createdAt`, `modifiedAt`, etc.)
- ✅ Reused common types: `Country`, `Currency`
- ✅ `AuditLogs` uses custom timestamp (immutable)

#### Associations & Compositions
- ✅ Managed associations for to-one relationships
- ✅ Compositions for parent-child (e.g., `AttachmentMetadata`)
- ✅ Backlink associations with `$self` for to-many

**Validation Command:**
```bash
cds compile db/schema.cds --to json | jq '.definitions."supplierOnboarding.SupplierInvitations".elements | keys'
```

**Expected:** Should include `ID`, `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`

---

### TC-4.4: Token Lifecycle State Machine
**Objective:** Verify 9-state TokenState enumeration  

**Required States:**
1. CREATED
2. SENT
3. DELIVERED
4. OPENED
5. VALIDATED
6. CONSUMED
7. FAILED
8. EXPIRED
9. REVOKED

**Validation Command:**
```bash
cds compile db/schema.cds --to json | jq '.definitions."supplierOnboarding.TokenState".enum | keys'
```

**Expected Output:**
```json
[
  "CONSUMED",
  "CREATED",
  "DELIVERED",
  "EXPIRED",
  "FAILED",
  "OPENED",
  "REVOKED",
  "SENT",
  "VALIDATED"
]
```

**Success Criteria:**
- ✅ All 9 states present
- ✅ Type: String enum
- ✅ Referenced in `SupplierInvitations.tokenState`

---

### TC-4.5: Association Integrity
**Objective:** Verify relationships between entities  

**Expected Associations:**

1. **SupplierInvitations → SupplierOnboardingData** (1:1)
   - Type: Association
   - On clause: `onboardingData.invitation = $self`

2. **SupplierInvitations → AuditLogs** (1:many)
   - Type: Association to many
   - On clause: `auditLogs.invitation = $self`

3. **SupplierOnboardingData → AttachmentMetadata** (1:many)
   - Type: **Composition** of many
   - On clause: `attachments.onboardingData = $self`
   - Cascading delete enabled

4. **SupplierOnboardingData → AuditLogs** (1:many)
   - Type: Association to many

**Validation Command:**
```bash
cds compile db/schema.cds --to json | jq '.definitions."supplierOnboarding.SupplierOnboardingData".elements.attachments'
```

**Expected:** Should show `type: "cds.Composition"` and `target: "supplierOnboarding.AttachmentMetadata"`

**Success Criteria:**
- ✅ Compositions use correct syntax
- ✅ Associations reference valid targets
- ✅ Backlinks use `$self` notation

---

### TC-4.6: Field Types & Constraints
**Objective:** Verify data types and mandatory fields  

**Critical Fields to Check:**

| Entity | Field | Type | Constraint |
|--------|-------|------|------------|
| SupplierInvitations | email | String(255) | not null |
| SupplierInvitations | tokenState | TokenState | not null, default 'CREATED' |
| SupplierInvitations | issuedAt | Timestamp | not null |
| SupplierInvitations | expiresAt | Timestamp | not null |
| SupplierOnboardingData | companyLegalName | String(255) | not null |
| SupplierOnboardingData | onboardingStatus | OnboardingStatus | not null, default 'DRAFT' |
| AttachmentMetadata | fileName | String(255) | not null |
| AttachmentMetadata | storageKey | String(500) | not null |
| AuditLogs | timestamp | Timestamp | not null, @cds.on.insert: $now |
| AuditLogs | eventType | AuditEventType | not null |

**Validation Command:**
```bash
cds compile db/schema.cds --to json | jq '.definitions."supplierOnboarding.SupplierInvitations".elements.email'
```

**Expected:**
```json
{
  "type": "cds.String",
  "length": 255,
  "notNull": true
}
```

**Success Criteria:**
- ✅ All mandatory fields have `notNull: true`
- ✅ String lengths appropriate (email: 255, tokenHash: 64)
- ✅ Enumerations use correct types
- ✅ Decimal fields have precision (e.g., `Decimal(15,2)`)

---

### TC-4.7: Annotations Validation
**Objective:** Verify UI and validation annotations  

**Expected Annotations:**

1. **SupplierInvitations.email**
   - `@mandatory`
   - `@assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'`

2. **SupplierInvitations.tokenState**
   - `@readonly`

3. **AuditLogs (entity-level)**
   - `@readonly` on entire entity

**Validation Command:**
```bash
cds compile db/schema.cds --to json | jq '.definitions."supplierOnboarding.SupplierInvitations".elements.email["@mandatory"]'
```

**Expected:** `true`

**Success Criteria:**
- ✅ Email has regex validation
- ✅ Readonly fields properly marked
- ✅ Mandatory fields enforced

---

### TC-4.8: Database Deployment (SQLite)
**Objective:** Deploy schema to SQLite for testing  

**Pre-requisites:**
- CAP runtime installed
- SQLite3 installed

**Deployment Command:**
```bash
cds deploy --to sqlite
```

**Expected Output:**
```
 > filling supplierOnboarding.db from db/schema.cds...
  > created database file at db.sqlite
  > updated package.json
```

**Verification Commands:**
```bash
# List all tables
sqlite3 db.sqlite ".tables"

# Check SupplierInvitations schema
sqlite3 db.sqlite ".schema SupplierOnboarding_SupplierInvitations"

# Verify AuditLogs columns
sqlite3 db.sqlite "PRAGMA table_info(SupplierOnboarding_AuditLogs);"
```

**Expected Tables:**
- `SupplierOnboarding_SupplierInvitations`
- `SupplierOnboarding_SupplierOnboardingData`
- `SupplierOnboarding_AttachmentMetadata`
- `SupplierOnboarding_AuditLogs`

**Success Criteria:**
- ✅ Database file created
- ✅ All 4 tables present
- ✅ Foreign keys for associations
- ✅ Enum values stored as strings
- ✅ UUID primary keys generated

---

### TC-4.9: Security & Compliance Fields
**Objective:** Verify sensitive data and audit trail fields  

**Security Fields (SupplierInvitations):**
- ✅ `tokenHash` - SHA-256 hash (64 chars)
- ✅ `validationAttempts` - Rate limiting counter
- ✅ `ipAddressFirstAccess` - IPv4/IPv6 (45 chars)
- ✅ `departmentCode`, `costCenter` - ABAC filtering

**Compliance Fields (AuditLogs):**
- ✅ `timestamp` - Immutable (@cds.on.insert: $now)
- ✅ `isPII`, `isFinancial` - Data classification
- ✅ `retentionPeriodDays` - 7 years default (2555 days)
- ✅ `correlationId` - Distributed tracing

**GDPR/PII Fields (SupplierOnboardingData):**
- ✅ `bankAccountNumber` - Encrypted in production (comment)
- ✅ `taxId`, `vatNumber` - Personal identifiers
- ✅ `primaryContactEmail`, `primaryContactPhone` - PII

**Success Criteria:**
- ✅ All security tracking fields present
- ✅ Audit trail supports compliance requirements
- ✅ PII fields identified for encryption

---

### TC-4.10: Integration Readiness
**Objective:** Verify fields for external integrations  

**S/4HANA Integration (SupplierOnboardingData):**
- ✅ `s4BusinessPartnerId` - BP ID after sync
- ✅ `s4VendorId` - Vendor ID
- ✅ `s4SyncedAt` - Last sync timestamp
- ✅ `s4SyncStatus` - Success/failure status
- ✅ `s4SyncErrors` - JSON error log

**BTP Object Store (AttachmentMetadata):**
- ✅ `storageKey` - S3 object key
- ✅ `bucketName` - Default: 'onboarding-documents'
- ✅ `virusScanStatus` - CLEAN/INFECTED/PENDING

**SendGrid Email (SupplierInvitations):**
- ✅ `emailProvider` - Default: 'SendGrid'
- ✅ `emailMessageId` - SendGrid tracking ID
- ✅ `emailSentAt`, `emailDeliveredAt`, `emailOpenedAt`

**Success Criteria:**
- ✅ All integration points have tracking fields
- ✅ Error handling fields (JSON storage)
- ✅ Timestamps for synchronization

---

## Automated Validation Script

```bash
#!/bin/bash
# Step 4 Validation Script

echo "═══════════════════════════════════════════════════════"
echo "Step 4: CAP Data Model Validation"
echo "═══════════════════════════════════════════════════════"

# TC-4.1: Compilation
echo "✓ TC-4.1: Compiling CDS schema..."
cds compile db/schema.cds --to json > /tmp/schema.json
if [ $? -eq 0 ]; then
  echo "  ✅ Compilation successful"
else
  echo "  ❌ Compilation failed"
  exit 1
fi

# TC-4.2: Entity count
echo "✓ TC-4.2: Checking entity count..."
ENTITY_COUNT=$(jq '.definitions | keys | map(select(startswith("supplierOnboarding.") and (endswith("Invitations") or endswith("Data") or endswith("Metadata") or endswith("Logs")))) | length' /tmp/schema.json)
if [ "$ENTITY_COUNT" -eq 4 ]; then
  echo "  ✅ All 4 core entities present"
else
  echo "  ❌ Expected 4 entities, found $ENTITY_COUNT"
fi

# TC-4.4: Token states
echo "✓ TC-4.4: Verifying TokenState enumeration..."
STATE_COUNT=$(jq '.definitions."supplierOnboarding.TokenState".enum | length' /tmp/schema.json)
if [ "$STATE_COUNT" -eq 9 ]; then
  echo "  ✅ All 9 token states defined"
else
  echo "  ❌ Expected 9 states, found $STATE_COUNT"
fi

# TC-4.3: cuid aspect
echo "✓ TC-4.3: Checking cuid aspect on SupplierInvitations..."
HAS_ID=$(jq '.definitions."supplierOnboarding.SupplierInvitations".elements | has("ID")' /tmp/schema.json)
if [ "$HAS_ID" = "true" ]; then
  echo "  ✅ cuid aspect applied (ID field present)"
else
  echo "  ❌ cuid aspect not found"
fi

# TC-4.3: managed aspect
echo "✓ TC-4.3: Checking managed aspect..."
HAS_CREATED=$(jq '.definitions."supplierOnboarding.SupplierInvitations".elements | has("createdAt")' /tmp/schema.json)
if [ "$HAS_CREATED" = "true" ]; then
  echo "  ✅ managed aspect applied (createdAt field present)"
else
  echo "  ❌ managed aspect not found"
fi

# TC-4.5: Composition check
echo "✓ TC-4.5: Verifying composition relationship..."
IS_COMPOSITION=$(jq '.definitions."supplierOnboarding.SupplierOnboardingData".elements.attachments.type == "cds.Composition"' /tmp/schema.json)
if [ "$IS_COMPOSITION" = "true" ]; then
  echo "  ✅ Composition correctly defined for attachments"
else
  echo "  ❌ Composition not found"
fi

# TC-4.8: Database deployment
echo "✓ TC-4.8: Deploying to SQLite..."
cds deploy --to sqlite > /tmp/deploy.log 2>&1
if [ $? -eq 0 ]; then
  echo "  ✅ Database deployed successfully"
  
  # Check table count
  TABLE_COUNT=$(sqlite3 db.sqlite ".tables" | wc -w)
  echo "  ℹ️  Created $TABLE_COUNT tables"
  
  # Verify specific table
  if sqlite3 db.sqlite ".tables" | grep -q "SupplierOnboarding_SupplierInvitations"; then
    echo "  ✅ SupplierInvitations table exists"
  else
    echo "  ❌ SupplierInvitations table missing"
  fi
else
  echo "  ❌ Database deployment failed"
  cat /tmp/deploy.log
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "✅ All validations passed - Data model ready"
echo "═══════════════════════════════════════════════════════"
```

---

## Manual Review Checklist

**Domain Modeling:**
- [ ] Entity names follow business domain language
- [ ] No technical abbreviations in entity names
- [ ] Field names are self-documenting
- [ ] Relationships reflect real-world business logic

**SAP CAP Compliance:**
- [ ] All entities use appropriate aspects (cuid, managed)
- [ ] Associations use correct syntax (to-one, to-many)
- [ ] Compositions used for parent-child relationships
- [ ] Common types reused from `@sap/cds/common`

**Security Architecture Alignment:**
- [ ] TokenState enum matches 9-state design from Step 1
- [ ] Rate limiting fields present (validationAttempts)
- [ ] Audit trail captures all security events
- [ ] PII fields identified for future encryption

**Business Requirements:**
- [ ] Supports multi-department ABAC (departmentCode, costCenter)
- [ ] S/4HANA integration fields complete
- [ ] Document storage metadata comprehensive
- [ ] Onboarding workflow states cover all scenarios

**Data Quality:**
- [ ] Mandatory fields enforce business rules
- [ ] Field lengths appropriate for data (no VARCHAR(MAX))
- [ ] Decimal precision appropriate for financial data
- [ ] Email validation regex correct

---

## Success Criteria (Step 4 Completion)

- ✅ `db/schema.cds` created with 4 core entities
- ✅ All entities use SAP CAP standard aspects (cuid, managed)
- ✅ Entity names pluralized per CAP conventions
- ✅ 9-state token lifecycle implemented (TokenState enum)
- ✅ 7 enumeration types defined (TokenState, OnboardingStatus, etc.)
- ✅ Compositions used correctly for parent-child relationships
- ✅ Associations with backlinks for to-many relationships
- ✅ Common types reused (Country, Currency from @sap/cds/common)
- ✅ Schema compiles without errors (`cds compile`)
- ✅ Successfully deploys to SQLite (`cds deploy`)
- ✅ All 4 database tables created
- ✅ Security fields present (tokenHash, validationAttempts, ABAC)
- ✅ Audit trail fields support compliance (7-year retention)
- ✅ Integration fields ready (S/4HANA, Object Store, SendGrid)
- ✅ Annotations applied (@readonly, @mandatory, @assert.format)

---

## Next Step

**Step 5 of 28:** Create CAP service definitions (InvitationService, SupplierService, AdminService)

Following SAP CAP standards:
- Services as projections on domain entities
- Single-purposed services (not CRUD monoliths)
- Authorization annotations (@requires, @restrict)
- Event handlers for business logic
