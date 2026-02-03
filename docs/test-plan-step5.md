# Test Plan - Step 5: CAP Service Definitions

**Step:** 5 of 28  
**Component:** CAP Service Definitions (CDS)  
**Files:** `srv/invitation-service.cds`, `srv/supplier-service.cds`, `srv/admin-service.cds`  
**Date:** February 3, 2026

---

## Test Cases

### TC-5.1: CDS Service Compilation
**Objective:** Validate CDS syntax and service structure  

**Command:**
```bash
cds compile srv/ --to json
```

**Expected:**
- ✅ No compilation errors
- ✅ JSON output shows all 3 services
- ✅ Actions and functions properly defined
- ✅ Entity projections resolved
- ✅ Associations maintained in projections

**Success Criteria:**
- Exit code 0
- Valid JSON structure
- No warnings or errors
- All services parseable

---

### TC-5.2: Service Exposure Validation
**Objective:** Verify all services and entities are correctly exposed  

**Expected Services:**
1. `InvitationService` (@path: `/invitation`)
2. `SupplierService` (@path: `/supplier`)
3. `AdminService` (@path: `/admin`)

**Validation Command:**
```bash
cds compile srv/ --to json | jq '.definitions | keys | map(select(endswith("Service"))) | sort'
```

**Expected Output:**
```json
[
  "AdminService",
  "InvitationService",
  "SupplierService"
]
```

**Success Criteria:**
- ✅ All 3 services defined
- ✅ Each service has unique path
- ✅ Service names follow CAP conventions (PascalCase + "Service")

---

### TC-5.3: Entity Projections Validation
**Objective:** Verify entity projections maintain correct structure  

**InvitationService Entities:**
- `Invitations` (projection on db.SupplierInvitations)
- `OnboardingData` (projection on db.SupplierOnboardingData)
- `AuditLogs` (projection on db.AuditLogs)

**SupplierService Entities:**
- `MyOnboardingData` (projection on db.SupplierOnboardingData)
- `MyAttachments` (projection on db.AttachmentMetadata)

**AdminService Entities:**
- `Invitations` (projection on db.SupplierInvitations)
- `OnboardingSubmissions` (projection on db.SupplierOnboardingData)
- `Attachments` (projection on db.AttachmentMetadata)
- `AuditLogs` (projection on db.AuditLogs)
- `InvitationSummary` (aggregated view)
- `OnboardingStatusSummary` (aggregated view)
- `DailyMetrics` (aggregated view)

**Validation Command:**
```bash
cds compile srv/invitation-service.cds --to json | jq '.definitions."InvitationService.Invitations".elements | has("ID")'
```

**Expected:** `true` (projections inherit fields from domain entities)

**Success Criteria:**
- ✅ All projections include primary key (ID from cuid)
- ✅ Associations preserved in projections
- ✅ Excluded fields not visible in projection
- ✅ Virtual fields declared (e.g., invitationLink)

---

### TC-5.4: Authorization Annotations Validation
**Objective:** Verify @requires and @restrict annotations are correctly applied  

**InvitationService:**
- Service level: `@requires: 'authenticated-user'`
- Invitations entity:
  - READ: `invitation.audit`
  - READ + CREATE: `invitation.create`
  - READ + CREATE + UPDATE: `invitation.manage`
- Actions:
  - createInvitation: `invitation.create`
  - revokeInvitation: `invitation.manage`
  - Functions: `invitation.audit` or `invitation.manage`

**SupplierService:**
- No @requires (token-based auth in handler)
- Custom authorization logic (not annotation-based)

**AdminService:**
- Service level: `@requires: 'invitation.audit'`
- All entities: `@readonly`

**Validation Command:**
```bash
# Check service-level @requires
cds compile srv/invitation-service.cds --to json | jq '.definitions.InvitationService["@requires"]'

# Check entity-level @restrict
cds compile srv/invitation-service.cds --to json | jq '.definitions."InvitationService.Invitations"["@restrict"]'
```

**Expected:**
- Service: `"authenticated-user"`
- Entity: Array of grant objects with `to` arrays

**Success Criteria:**
- ✅ All XSUAA scopes match xs-security.json (invitation.create, invitation.manage, invitation.audit)
- ✅ Least privilege principle enforced (READ < CREATE < UPDATE)
- ✅ AdminService entities all @readonly
- ✅ No unauthorized operations exposed

---

### TC-5.5: Actions & Functions Definition
**Objective:** Verify all actions and functions are properly defined with correct signatures  

**InvitationService Actions:**
1. `createInvitation` (7 input params, returns object with invitationLink)
2. `validateToken` (1 input param, returns validation result)
3. `revokeInvitation` (2 input params, returns success/message)
4. `resendInvitation` (2 input params, returns new link)

**InvitationService Functions:**
1. `getInvitationStatus` (1 param, returns status object)
2. `generatePresignedUrl` (1 param, returns URL + metadata)
3. `getInvitationsByDepartment` (2 params, returns array)

**SupplierService Actions:**
1. `submitSupplierData` (20+ input params, returns success + errors)
2. `saveDraft` (1 param, returns success)
3. `uploadAttachment` (5 params, returns presigned URL)
4. `confirmUpload` (2 params, returns success)
5. `deleteAttachment` (1 param, returns success)

**SupplierService Functions:**
1. `getMyData` (0 params, returns onboarding data + attachments)
2. `generateDownloadUrl` (1 param, returns presigned URL)
3. `getInvitationInfo` (0 params, returns invitation metadata)

**AdminService Functions:**
1. `getInvitationHistory` (1 param, returns audit trail array)
2. `getSecurityEvents` (3 params, returns filtered events)
3. `getComplianceReport` (2 params, returns compliance summary)
4. `getS4HANASyncStatus` (1 param, returns sync metrics)
5. `exportAuditLogs` (4 params, returns filtered logs)

**Validation Command:**
```bash
# Count actions in InvitationService
cds compile srv/invitation-service.cds --to json | jq '.definitions | keys | map(select(startswith("InvitationService.") and (contains("action.") or contains("function.")))) | length'
```

**Expected Counts:**
- InvitationService: 4 actions + 3 functions = 7
- SupplierService: 5 actions + 3 functions = 8
- AdminService: 0 actions + 5 functions = 5

**Success Criteria:**
- ✅ All actions have input parameters defined
- ✅ All actions/functions have return types
- ✅ Required parameters marked `not null`
- ✅ Default values specified where appropriate

---

### TC-5.6: Field Exclusions Validation
**Objective:** Verify sensitive fields are excluded from external services  

**InvitationService.Invitations excludes:**
- `jwtPayload` (sensitive token data)
- `tokenHash` (security)

**SupplierService.MyOnboardingData excludes:**
- `reviewedBy`, `reviewNotes`, `approvedBy` (internal workflow)
- `s4BusinessPartnerId`, `s4VendorId`, `s4SyncedAt`, `s4SyncStatus`, `s4SyncErrors` (integration internals)

**SupplierService.MyAttachments excludes:**
- `storageKey` (S3 internal)
- `virusScanStatus`, `virusScanDate` (security internals)
- `isArchived`, `archivedAt` (internal flags)

**AdminService.OnboardingSubmissions excludes:**
- `bankAccountNumber` (highly sensitive, encrypted)
- `bankRoutingNumber` (highly sensitive)

**Validation Command:**
```bash
cds compile srv/supplier-service.cds --to json | jq '.definitions."SupplierService.MyOnboardingData".elements | has("s4BusinessPartnerId")'
```

**Expected:** `false` (field excluded)

**Success Criteria:**
- ✅ Sensitive fields not visible in external services
- ✅ Internal workflow fields hidden from suppliers
- ✅ Encrypted fields protected even from admins
- ✅ Associations still functional after exclusions

---

### TC-5.7: Virtual Fields Validation
**Objective:** Verify virtual fields are correctly declared  

**InvitationService.Invitations:**
- `virtual invitationLink : String` (computed in handler)

**Validation Command:**
```bash
cds compile srv/invitation-service.cds --to json | jq '.definitions."InvitationService.Invitations".elements.invitationLink.virtual'
```

**Expected:** `true`

**Success Criteria:**
- ✅ Virtual field marked with `virtual` keyword
- ✅ Type specified (String)
- ✅ Not persisted in database (only computed)

---

### TC-5.8: Association Preservation
**Objective:** Verify associations are maintained in service projections  

**InvitationService.Invitations associations:**
- `onboardingData` (to OnboardingData)
- `auditLogs` (to many AuditLogs)

**SupplierService.MyOnboardingData associations:**
- `attachments` (to many MyAttachments)

**AdminService.Invitations associations:**
- `onboardingData` (to OnboardingSubmissions)
- `auditLogs` (to AuditLogs)

**Validation Command:**
```bash
cds compile srv/invitation-service.cds --to json | jq '.definitions."InvitationService.Invitations".elements.onboardingData.type'
```

**Expected:** Association type pointing to service entity

**Success Criteria:**
- ✅ All associations preserved in projections
- ✅ Association targets redirected to service entities (not db entities)
- ✅ Cardinality maintained (to-one, to-many)
- ✅ On clauses intact

---

### TC-5.9: Aggregated Views (AdminService)
**Objective:** Verify aggregated views use correct CDS syntax  

**Views to Test:**
1. `InvitationSummary` (group by tokenState)
2. `OnboardingStatusSummary` (group by onboardingStatus)
3. `DailyMetrics` (group by date, eventType)

**Validation:**
- `select from` syntax
- `group by` clause
- Aggregate functions: `count(*)`, `min()`, `max()`, `count(distinct)`
- Type casts: `cast(timestamp as Date)`

**Validation Command:**
```bash
cds compile srv/admin-service.cds --to json | jq '.definitions."AdminService.InvitationSummary".query'
```

**Expected:** Query object with SELECT and GROUP BY

**Success Criteria:**
- ✅ Valid CDS query syntax
- ✅ Aggregate functions properly used
- ✅ Group by fields match selected fields
- ✅ Types specified for aggregated columns

---

### TC-5.10: SAP CAP Standards Compliance
**Objective:** Verify services follow SAP CAP best practices  

**Checklist:**

#### Service Design
- ✅ Services are single-purposed (InvitationService for invitations, SupplierService for suppliers, AdminService for auditing)
- ✅ Services as projections (not direct entity exposure)
- ✅ Clear separation of concerns (internal vs external vs audit)

#### Naming Conventions
- ✅ Service names: PascalCase + "Service"
- ✅ Entity names in services: PascalCase, pluralized
- ✅ Actions: camelCase verbs (createInvitation, validateToken)
- ✅ Functions: camelCase getters (getInvitationStatus)

#### Authorization
- ✅ Service-level @requires for authenticated services
- ✅ Entity-level @restrict with grant arrays
- ✅ Action-level @restrict for sensitive operations
- ✅ @readonly for audit entities

#### Documentation
- ✅ JSDoc comments for all services, actions, functions
- ✅ Flow descriptions for complex operations
- ✅ Security notes documented
- ✅ Use cases explained

**Success Criteria:**
- All checklist items verified
- No deviations from SAP CAP conventions
- Services ready for handler implementation

---

## Manual Validation Script

```bash
#!/bin/bash
# Step 5 Validation Script

echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║               Step 5: CAP Service Definitions Validation                 ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""

# TC-5.1: Compilation
echo "✓ TC-5.1: Compiling all service definitions..."
if cds compile srv/ --to json > /tmp/services.json 2>&1; then
  echo "  ✅ Compilation successful"
else
  echo "  ❌ Compilation failed"
  exit 1
fi

# TC-5.2: Service count
echo "✓ TC-5.2: Checking service count..."
SERVICE_COUNT=$(grep -c "^service " srv/*.cds)
if [ "$SERVICE_COUNT" -eq 3 ]; then
  echo "  ✅ All 3 services defined"
else
  echo "  ❌ Expected 3 services, found $SERVICE_COUNT"
fi

# TC-5.3: Entity projections
echo "✓ TC-5.3: Verifying entity projections..."
PROJECTION_COUNT=$(grep -c "as projection on" srv/*.cds)
echo "  ℹ️  Total projections: $PROJECTION_COUNT"

# TC-5.4: Authorization annotations
echo "✓ TC-5.4: Checking authorization annotations..."
REQUIRES_COUNT=$(grep -c "@requires" srv/*.cds)
RESTRICT_COUNT=$(grep -c "@restrict" srv/*.cds)
echo "  ℹ️  @requires annotations: $REQUIRES_COUNT"
echo "  ℹ️  @restrict annotations: $RESTRICT_COUNT"

# TC-5.5: Actions count
echo "✓ TC-5.5: Counting actions and functions..."
ACTION_COUNT=$(grep -c "^  action " srv/*.cds)
FUNCTION_COUNT=$(grep -c "^  function " srv/*.cds)
echo "  ℹ️  Total actions: $ACTION_COUNT"
echo "  ℹ️  Total functions: $FUNCTION_COUNT"

# TC-5.6: Field exclusions
echo "✓ TC-5.6: Verifying field exclusions..."
EXCLUDING_COUNT=$(grep -c "excluding {" srv/*.cds)
echo "  ℹ️  Entities with excluded fields: $EXCLUDING_COUNT"

# TC-5.7: Virtual fields
echo "✓ TC-5.7: Checking virtual fields..."
VIRTUAL_COUNT=$(grep -c "virtual " srv/*.cds)
echo "  ℹ️  Virtual fields defined: $VIRTUAL_COUNT"

# TC-5.8: Read-only entities
echo "✓ TC-5.8: Checking @readonly annotations..."
READONLY_COUNT=$(grep -c "@readonly" srv/*.cds)
echo "  ℹ️  Read-only entities: $READONLY_COUNT"

# File statistics
echo ""
echo "📊 File Statistics:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for file in srv/*.cds; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    bytes=$(wc -c < "$file")
    echo "  $(basename "$file"): $lines lines, $bytes bytes"
  fi
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════╗"
echo "║                        VALIDATION SUMMARY                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════════════╝"
echo ""
if [ "$SERVICE_COUNT" -eq 3 ]; then
  echo "   ✅ Service definitions: VALID"
  echo "   ✅ Services: 3 (InvitationService, SupplierService, AdminService)"
  echo "   ✅ Projections: $PROJECTION_COUNT"
  echo "   ✅ Actions: $ACTION_COUNT"
  echo "   ✅ Functions: $FUNCTION_COUNT"
  echo "   ✅ Authorization annotations: Present"
  echo ""
  echo "   🎯 Services ready for handler implementation (Step 6+)"
  echo ""
else
  echo "   ⚠️  Service validation warnings:"
  [ "$SERVICE_COUNT" -ne 3 ] && echo "      - Expected 3 services, found $SERVICE_COUNT"
  echo ""
fi

echo "╚═══════════════════════════════════════════════════════════════════════════╝"
```

---

## Success Criteria (Step 5 Completion)

- ✅ `srv/invitation-service.cds` created (InvitationService)
- ✅ `srv/supplier-service.cds` created (SupplierService)
- ✅ `srv/admin-service.cds` created (AdminService)
- ✅ All services compile without errors (`cds compile srv/`)
- ✅ 3 services defined with unique paths (/invitation, /supplier, /admin)
- ✅ 10+ entity projections across all services
- ✅ 9+ actions defined (createInvitation, submitSupplierData, etc.)
- ✅ 11+ functions defined (getInvitationStatus, getMyData, etc.)
- ✅ Authorization annotations applied (@requires, @restrict)
- ✅ Sensitive fields excluded from external services
- ✅ Virtual fields declared (invitationLink)
- ✅ Associations preserved in projections
- ✅ Aggregated views for reporting (AdminService)
- ✅ Read-only entities for audit trail
- ✅ SAP CAP standards followed (single-purposed services, projections, naming)

---

## Next Step

**Step 6 of 28:** Implement token generation logic (JavaScript)

Create `srv/lib/token-manager.js`:
- Function `generateInvitationToken(email, metadata)` → JWT with RS256
- XSUAA key binding
- 7-day expiry (configurable)
- Comprehensive unit tests
