# Step 8 Test Plan – Invitation Service Handlers

**Step**: 8 of 28  
**Component**: CAP Service Handlers  
**Module**: `srv/invitation-service.js`  
**Date**: 2025-01-XX  

## 1. Overview

### Purpose
Verify that the invitation service handlers correctly implement business logic for invitation lifecycle management, enforce XSUAA authorization, and integrate with token generation/validation services.

### Scope
- CAP service handler registration and execution
- Action handlers: createInvitation, validateToken, revokeInvitation, resendInvitation
- Function handlers: getInvitationStatus
- XSUAA role-based authorization
- Rate limiting enforcement
- Database state transitions
- Audit logging for compliance
- Error handling and validation

### Test Environment
- **Runtime**: Node.js 18+ with CAP framework
- **Database**: SQLite (in-memory for tests)
- **Authentication**: Mock XSUAA with test keypair
- **Framework**: Jest with CAP test utilities

## 2. Test Coverage Matrix

### 2.1 Action Handler Tests

| Test ID | Handler | Scenario | Expected Result | Priority |
|---------|---------|----------|-----------------|----------|
| AH-01 | createInvitation | Valid input with all required fields | Returns invitation ID, link, expiresAt | P0 |
| AH-02 | createInvitation | Valid input with optional fields | Stores all fields in database | P0 |
| AH-03 | createInvitation | Invalid email format | Throws 400 error before handler | P0 |
| AH-04 | createInvitation | Duplicate active invitation | Throws 409 error with message | P0 |
| AH-05 | createInvitation | expiryDays > 30 | Throws 400 error | P0 |
| AH-06 | createInvitation | expiryDays < 1 | Throws 400 error | P0 |
| AH-07 | createInvitation | Database stores tokenHash, jwtPayload | Verification via SELECT | P0 |
| AH-08 | createInvitation | Audit log created (INVITATION_CREATED) | Verify AuditLogs entry | P0 |
| AH-09 | validateToken | Valid JWT token | Returns valid=true, invitation details | P0 |
| AH-10 | validateToken | Invalid JWT format | Returns valid=false, error code | P0 |
| AH-11 | validateToken | Missing token | Returns valid=false, MISSING_TOKEN | P0 |
| AH-12 | validateToken | Expired token | Returns valid=false, TOKEN_EXPIRED | P0 |
| AH-13 | validateToken | Updates tokenState to VALIDATED | Database state changes | P0 |
| AH-14 | validateToken | Increments validationAttempts | Counter increases | P0 |
| AH-15 | validateToken | Audit log (TOKEN_VALIDATED) | Verify AuditLogs entry | P0 |
| AH-16 | revokeInvitation | Valid invitationId | Returns success=true | P0 |
| AH-17 | revokeInvitation | Updates tokenState to REVOKED | Database state changes | P0 |
| AH-18 | revokeInvitation | Stores revocationReason | Verify in database | P0 |
| AH-19 | revokeInvitation | Audit log (TOKEN_REVOKED) | Verify AuditLogs entry | P0 |
| AH-20 | revokeInvitation | Non-existent invitation | Throws 404 error | P0 |
| AH-21 | revokeInvitation | Already consumed invitation | Throws 400 error | P0 |
| AH-22 | revokeInvitation | Already revoked invitation | Throws 400 error | P0 |
| AH-23 | resendInvitation | Valid invitationId | Returns new invitationLink | P0 |
| AH-24 | resendInvitation | Generates new token | Link different from original | P0 |
| AH-25 | resendInvitation | Resets validationAttempts to 0 | Database field reset | P0 |
| AH-26 | resendInvitation | Updates tokenState to CREATED | State reset from VALIDATED | P0 |
| AH-27 | resendInvitation | Audit log (INVITATION_RESENT) | Verify AuditLogs entry | P0 |
| AH-28 | resendInvitation | Consumed invitation | Throws 400 error | P0 |
| AH-29 | getInvitationStatus | Valid invitationId | Returns status with computed fields | P0 |
| AH-30 | getInvitationStatus | Expired invitation | isExpired=true | P0 |
| AH-31 | getInvitationStatus | Active invitation | isActive=true | P0 |
| AH-32 | getInvitationStatus | Non-existent invitation | Throws 404 error | P0 |

### 2.2 Authorization Tests

| Test ID | Handler | User Role | Expected Result | Priority |
|---------|---------|-----------|-----------------|----------|
| AU-01 | createInvitation | invitation.create scope | ✅ Allowed | P0 |
| AU-02 | createInvitation | No scope | ❌ 403 Forbidden | P0 |
| AU-03 | createInvitation | invitation.manage only | ❌ 403 Forbidden | P1 |
| AU-04 | validateToken | No authentication (public) | ✅ Allowed | P0 |
| AU-05 | revokeInvitation | invitation.manage scope | ✅ Allowed | P0 |
| AU-06 | revokeInvitation | invitation.create only | ❌ 403 Forbidden | P0 |
| AU-07 | resendInvitation | invitation.create scope | ✅ Allowed | P0 |
| AU-08 | resendInvitation | No scope | ❌ 403 Forbidden | P0 |
| AU-09 | getInvitationStatus | invitation.audit scope | ✅ Allowed | P0 |
| AU-10 | getInvitationStatus | No scope | ❌ 403 Forbidden | P0 |

### 2.3 Rate Limiting Tests

| Test ID | Scenario | Expected Result | Priority |
|---------|----------|-----------------|----------|
| RL-01 | Create 100 invitations in 1 hour | All succeed | P0 |
| RL-02 | Create 101st invitation in same hour | Throws 429 error | P0 |
| RL-03 | Create after 1 hour elapsed | Allowed (rate limit reset) | P1 |
| RL-04 | Validate token 5 times | All succeed | P0 |
| RL-05 | 6th validation attempt | Fails with RATE_LIMIT_EXCEEDED | P0 |

### 2.4 Database State Tests

| Test ID | Operation | Before State | After State | Priority |
|---------|-----------|--------------|-------------|----------|
| DB-01 | createInvitation | - | CREATED | P0 |
| DB-02 | validateToken (1st) | CREATED | VALIDATED | P0 |
| DB-03 | validateToken (2nd+) | VALIDATED | VALIDATED | P0 |
| DB-04 | revokeInvitation | CREATED | REVOKED | P0 |
| DB-05 | revokeInvitation | VALIDATED | REVOKED | P0 |
| DB-06 | resendInvitation | VALIDATED | CREATED | P0 |
| DB-07 | resendInvitation | FAILED | CREATED | P1 |

### 2.5 Audit Logging Tests

| Test ID | Event Type | Trigger | Required Fields | Priority |
|---------|-----------|---------|-----------------|----------|
| AL-01 | INVITATION_CREATED | createInvitation success | invitationId, userId, eventData | P0 |
| AL-02 | INVITATION_CREATION_FAILED | createInvitation error | userId, error details | P0 |
| AL-03 | TOKEN_VALIDATED | validateToken success | invitationId, ipAddress | P0 |
| AL-04 | TOKEN_VALIDATION_FAILED | validateToken failure | error code/message | P0 |
| AL-05 | TOKEN_REVOKED | revokeInvitation | invitationId, userId, reason | P0 |
| AL-06 | REVOCATION_FAILED | revokeInvitation error | error details | P1 |
| AL-07 | INVITATION_RESENT | resendInvitation | invitationId, new expiresAt | P0 |

### 2.6 Integration Tests

| Test ID | Integration Point | Test Scenario | Expected Result | Priority |
|---------|-------------------|---------------|-----------------|----------|
| IN-01 | token-manager.js | Call generateInvitationToken() | Returns valid JWT | P0 |
| IN-02 | token-validator.js | Call validateToken() | Returns validation result | P0 |
| IN-03 | Database | Insert SupplierInvitations | Record created | P0 |
| IN-04 | Database | Update tokenState | Field updated | P0 |
| IN-05 | Database | Insert AuditLogs | Record created | P0 |
| IN-06 | Environment vars | Read INVITATION_BASE_URL | Uses config value | P1 |
| IN-07 | Environment vars | Read XSUAA keys | JWT operations work | P0 |

## 3. Test Data

### 3.1 Valid Test Inputs

```javascript
// Valid createInvitation input
{
  email: "supplier@example.com",
  companyName: "Test Company GmbH",
  contactName: "Jane Doe",
  departmentCode: "PURCHASING",
  costCenter: "CC-001",
  expiryDays: 7
}

// Minimal valid input
{
  email: "supplier@example.com",
  companyName: "Test Company"
}
```

### 3.2 Invalid Test Inputs

```javascript
// Invalid email
{ email: "invalid-email", companyName: "Test" }

// Missing required fields
{ companyName: "Test Company" } // Missing email

// Invalid expiryDays
{ email: "test@example.com", companyName: "Test", expiryDays: 100 }
{ email: "test@example.com", companyName: "Test", expiryDays: 0 }
```

### 3.3 Mock User Contexts

```javascript
// User with invitation.create scope
const purchaser = {
  id: "USER123",
  name: "John Smith",
  scopes: ["invitation.create"]
};

// User with invitation.manage scope
const admin = {
  id: "ADMIN001",
  name: "Admin User",
  scopes: ["invitation.manage", "invitation.create"]
};

// User with invitation.audit scope
const auditor = {
  id: "AUDIT001",
  name: "Auditor User",
  scopes: ["invitation.audit"]
};

// User with no scopes
const unauthorized = {
  id: "USER999",
  name: "Unauthorized User",
  scopes: []
};
```

## 4. Manual Validation Checklist

### 4.1 Pre-Test Setup
- [ ] Database schema deployed (Step 4)
- [ ] Service definitions deployed (Step 5)
- [ ] token-manager.js available (Step 6)
- [ ] token-validator.js available (Step 7)
- [ ] Environment variables configured
- [ ] Test keypair generated

### 4.2 Function Tests
- [ ] createInvitation returns valid invitation link
- [ ] Invitation link contains JWT token parameter
- [ ] validateToken accepts JWT from link
- [ ] revokeInvitation prevents token validation
- [ ] resendInvitation generates new token
- [ ] getInvitationStatus returns accurate state

### 4.3 Database Validation
- [ ] SupplierInvitations table has new records
- [ ] tokenHash stored (not plaintext token)
- [ ] jwtPayload stored for debugging
- [ ] AuditLogs table has entries for all operations
- [ ] Timestamps (issuedAt, expiresAt) are correct

### 4.4 Security Validation
- [ ] JWT signature verified with public key
- [ ] Expired tokens rejected
- [ ] Revoked invitations cannot be used
- [ ] Rate limits enforced
- [ ] Authorization scopes checked

### 4.5 Error Handling
- [ ] Invalid email returns 400
- [ ] Duplicate invitation returns 409
- [ ] Non-existent invitation returns 404
- [ ] Consumed invitation returns 400
- [ ] Rate limit exceeded returns 429

## 5. Acceptance Criteria

### Must Have (P0)
- ✅ All action handlers implemented and functional
- ✅ XSUAA authorization enforced via @restrict annotations
- ✅ Rate limiting works (100/hour for creation, 5 for validation)
- ✅ Database state transitions correct (CREATED → VALIDATED → CONSUMED/REVOKED)
- ✅ Audit logging for all operations (success and failure)
- ✅ Integration with token-manager and token-validator
- ✅ Error handling with proper HTTP status codes
- ✅ Email validation before handler execution
- ✅ Duplicate invitation detection
- ✅ Token regeneration for resend

### Should Have (P1)
- ✅ Comprehensive unit tests (30+ test cases)
- ✅ Test coverage > 90%
- ✅ Manual validation script
- ✅ Test plan documentation

### Nice to Have (P2)
- Integration tests with real XSUAA instance
- Performance tests (load testing)
- Security penetration tests

## 6. Test Execution

### 6.1 Automated Tests
```bash
# Run all tests
npm test test/invitation-service.test.js

# Run with coverage
npm run test:coverage

# Expected output:
# - All test suites passed
# - Coverage: Statements > 90%, Branches > 85%
# - No failed assertions
```

### 6.2 Manual Tests
```bash
# Run manual validation script
node scripts/validate-step8.js

# Expected output:
# - All test scenarios pass
# - Database state verified
# - Audit logs created
```

## 7. Defect Tracking

### Known Issues
- None identified

### Resolved Issues
- None tracked

## 8. Sign-Off

### Test Execution Summary
- Total Test Cases: 32 (automated) + 5 (manual)
- Passed: TBD
- Failed: TBD
- Blocked: TBD
- Coverage: TBD%

### Approval
- [ ] Developer: Tests written and passing
- [ ] Reviewer: Test coverage adequate
- [ ] Security: Authorization tests validated
- [ ] Ready for Step 9: Yes/No

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-XX  
**Owner**: SAP BTP Supplier Onboarding Team
