# Step 1 Test Plan – Security Architecture

## Objective
Verify that the security architecture documentation is complete, correct, and testable.

---

## Test Cases

### TC1.1 - Token Schema Validation

**Test**: Review JWT token structure  
**Expected Result**:
- ✅ All required claims documented (iss, sub, aud, exp, iat, jti)
- ✅ Custom claims clearly defined (invitation_id, supplier_email, etc.)
- ✅ Algorithm specified (RS256)
- ✅ Expiry calculation explained (7 days)

**Success Criteria**: Documentation includes example token and claims table

---

### TC1.2 - Token Lifecycle Completeness

**Test**: Review state machine diagram  
**Expected Result**:
- ✅ All 8 states defined (CREATED, SENT, ACCESSED, IN_PROGRESS, SUBMITTED, CONSUMED, EXPIRED, REVOKED)
- ✅ State transitions documented with triggers
- ✅ End states clearly marked
- ✅ Validation rules per transition defined

**Success Criteria**: Can trace complete happy path (CREATED → CONSUMED) and error paths

---

### TC1.3 - XSUAA Scopes & Roles

**Test**: Review XSUAA configuration  
**Expected Result**:
- ✅ 4 scopes defined (supplier.onboard, invitation.create, invitation.manage, invitation.audit)
- ✅ 3 role templates defined (Purchaser, Admin, Auditor)
- ✅ Role collections mapped to BTP naming convention
- ✅ Least privilege principle applied

**Success Criteria**: Each role has clear purpose and scope assignment

---

### TC1.4 - Security Controls Coverage

**Test**: Review threat mitigation table  
**Expected Result**:
- ✅ Token threats addressed (interception, replay, forgery, brute force)
- ✅ Data protection documented (in-transit, at-rest)
- ✅ Rate limiting rules defined
- ✅ Audit logging events specified

**Success Criteria**: All OWASP Top 10 relevant threats mitigated

---

### TC1.5 - Compliance Requirements

**Test**: Review GDPR and retention policies  
**Expected Result**:
- ✅ Data retention periods defined
- ✅ Right to access/erasure documented
- ✅ Audit log retention (7 years) specified
- ✅ PII handling guidelines included

**Success Criteria**: Can demonstrate GDPR compliance to auditor

---

## Common Failure Modes

| Issue | Symptom | Resolution |
|-------|---------|------------|
| Missing token claim | Implementation error in Step 6 | Add claim to token-manager.js |
| Invalid state transition | Business logic error | Update state machine rules |
| Missing scope | Authorization fails | Add scope to xs-security.json |
| Insufficient logging | Cannot trace security events | Add audit log entry |

---

## Verification Checklist

Before proceeding to Step 2:

- [ ] security-architecture.md file created
- [ ] JWT token schema documented with all claims
- [ ] Token lifecycle state machine diagram complete
- [ ] XSUAA scopes and roles defined (4 scopes, 3 role templates)
- [ ] Security controls and threat mitigation table complete
- [ ] Rate limiting rules specified
- [ ] Audit logging events defined
- [ ] GDPR compliance section included
- [ ] .env.template created with all required variables
- [ ] .gitignore configured to exclude credentials

---

## Manual Review Questions

1. **Token Expiry**: Is 7 days appropriate for supplier onboarding? (Consider: supplier may be on vacation, link should not be too long-lived)  
   ✅ Yes - balanced between usability and security

2. **Single-use Token**: Should we allow multiple form saves before submission?  
   ✅ Yes - state IN_PROGRESS allows draft saves, token consumed only on final submission

3. **Rate Limiting**: Are 5 validation attempts sufficient?  
   ✅ Yes - legitimate user needs max 2-3 attempts (typo, refresh), 5 provides buffer

4. **Audit Retention**: Is 7 years correct for audit logs?  
   ✅ Yes - typical regulatory requirement (SOX, GDPR allows longer retention for compliance)

---

**Test Plan Status**: ✅ Complete  
**Ready for Implementation**: Yes  
**Next Action**: Proceed to Step 2 if all checklist items verified
