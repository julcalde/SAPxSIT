# Step 3 Test Plan: XSUAA Security Descriptor Validation

**Date:** February 3, 2026  
**Objective:** Validate and enhance xs-security.json against SAP CAP and BTP security standards

---

## Test Cases

### TC-3.1: JSON Schema Validation

**Objective:** Ensure xs-security.json is valid JSON and contains all required fields

**Prerequisites:** xs-security.json file exists

**Test Steps:**
1. Validate JSON syntax (no parsing errors)
2. Verify required fields present:
   - `xsappname`
   - `tenant-mode`
   - `scopes`
   - `role-templates`
   - `oauth2-configuration`
3. Check field types match XSUAA schema

**Expected Result:**
- Valid JSON format
- All required fields present
- Correct data types for all values

**Pass Criteria:**
- ✅ JSON parses without errors
- ✅ All required XSUAA fields present
- ✅ No schema validation errors

---

### TC-3.2: Scope Definition Validation

**Objective:** Verify all application scopes are properly defined

**Prerequisites:** xs-security.json contains scopes array

**Test Steps:**
1. Verify 4 scopes defined:
   - `supplier.onboard` (external suppliers)
   - `invitation.create` (purchasers)
   - `invitation.manage` (admins)
   - `invitation.audit` (auditors)
2. Check each scope has:
   - `name` with `$XSAPPNAME` prefix
   - `description` field
3. Validate scope naming convention (lowercase with dots)

**Expected Result:**
- All 4 scopes present and correctly named
- Descriptions match business requirements
- Proper XSUAA variable usage

**Pass Criteria:**
- ✅ 4 scopes defined
- ✅ All use `$XSAPPNAME` prefix
- ✅ Descriptions are clear and accurate

---

### TC-3.3: Role Template Configuration

**Objective:** Validate role templates map scopes correctly

**Prerequisites:** xs-security.json contains role-templates array

**Test Steps:**
1. Verify 3 role templates:
   - `SupplierOnboardingPurchaser`
   - `SupplierOnboardingAdmin`
   - `SupplierOnboardingAuditor`
2. Check scope mappings:
   - Purchaser: `invitation.create` only
   - Admin: `invitation.create` + `invitation.manage` + `invitation.audit`
   - Auditor: `invitation.audit` only
3. Verify attribute references for Purchaser role (Department, CostCenter)
4. Validate role descriptions match business intent

**Expected Result:**
- Least privilege principle applied
- Admin has superset of Purchaser permissions
- Auditor read-only access
- Attributes enable organizational filtering

**Pass Criteria:**
- ✅ 3 role templates defined
- ✅ Scope assignments match security matrix
- ✅ Purchaser role includes attributes for filtering
- ✅ Separation of duties maintained

---

### TC-3.4: Role Collection Mapping

**Objective:** Ensure role collections reference correct role templates

**Prerequisites:** xs-security.json contains role-collections array

**Test Steps:**
1. Verify 3 role collections:
   - `supplier-onboarding-purchaser-rc`
   - `supplier-onboarding-admin-rc`
   - `supplier-onboarding-auditor-rc`
2. Check each collection:
   - Has descriptive name with `-rc` suffix
   - References correct role template via `$XSAPPNAME`
   - Includes description
3. Validate 1:1 mapping (each role collection maps to one role template)

**Expected Result:**
- Role collections follow BTP naming convention
- Correct template references
- Ready for assignment to users/user groups

**Pass Criteria:**
- ✅ 3 role collections defined
- ✅ Names follow `-rc` suffix convention
- ✅ Correct `$XSAPPNAME` references
- ✅ Descriptions present

---

### TC-3.5: OAuth2 Configuration

**Objective:** Validate OAuth2 settings for authentication flows

**Prerequisites:** xs-security.json contains oauth2-configuration

**Test Steps:**
1. Verify redirect URIs include:
   - BAS: `https://*.applicationstudio.cloud.sap/**`
   - Cloud Foundry: `https://*.cfapps.*.hana.ondemand.com/**`
   - Local dev: `http://localhost:*/**`
2. Check token validity:
   - Access token: 43200 seconds (12 hours)
   - Refresh token: 86400 seconds (24 hours)
3. Verify system-attributes includes `rolecollections`
4. Check `autoapprove: false` for secure consent flow

**Expected Result:**
- All deployment environments covered
- Token lifetimes balance security and usability
- Role collections available in JWT
- Explicit user consent required

**Pass Criteria:**
- ✅ Redirect URIs cover all environments
- ✅ Token validity set correctly
- ✅ System attributes configured
- ✅ Autoapprove disabled for security

---

### TC-3.6: Attribute-Based Access Control (ABAC)

**Objective:** Validate custom attributes for fine-grained authorization

**Prerequisites:** xs-security.json contains attributes array

**Test Steps:**
1. Verify 2 custom attributes defined:
   - `Department` (string)
   - `CostCenter` (string)
2. Check attribute usage in Purchaser role template
3. Validate attribute descriptions are clear
4. Verify `valueType` set to `string`

**Expected Result:**
- Attributes enable organizational filtering
- Purchasers can filter invitations by their department/cost center
- Attribute values can be assigned via IDP (Identity Provider)

**Pass Criteria:**
- ✅ 2 attributes defined
- ✅ Used in Purchaser role template
- ✅ Descriptions explain purpose
- ✅ Value types correct

---

### TC-3.7: Security Best Practices Compliance

**Objective:** Ensure configuration follows SAP BTP security guidelines

**Prerequisites:** Complete xs-security.json

**Test Steps:**
1. Verify `tenant-mode: "dedicated"` for single-tenant app
2. Check no hardcoded secrets or credentials
3. Validate descriptions help with auditing
4. Ensure `foreign-scope-references` empty (no external dependencies)
5. Check `authorities` includes `$ACCEPT_GRANTED_AUTHORITIES`

**Expected Result:**
- Security descriptor production-ready
- Follows SAP BTP best practices
- No security vulnerabilities
- Supports compliance auditing

**Pass Criteria:**
- ✅ Tenant mode appropriate
- ✅ No sensitive data exposed
- ✅ Audit-friendly descriptions
- ✅ No unnecessary external dependencies
- ✅ Standard authorities configured

---

## Verification Checklist

### File Structure
- [ ] xs-security.json exists in project root
- [ ] Valid JSON syntax (can be parsed)
- [ ] File size < 10KB (reasonable for XSUAA)
- [ ] UTF-8 encoding

### Required Fields
- [ ] `xsappname`: "supplier-onboarding"
- [ ] `tenant-mode`: "dedicated"
- [ ] `description`: Present and accurate
- [ ] `scopes`: Array with 4 items
- [ ] `attributes`: Array with 2 items
- [ ] `role-templates`: Array with 3 items
- [ ] `role-collections`: Array with 3 items
- [ ] `oauth2-configuration`: Object with required fields

### Security Validation
- [ ] All scopes use `$XSAPPNAME` prefix
- [ ] Role templates reference valid scopes
- [ ] Role collections reference valid templates
- [ ] Least privilege principle applied
- [ ] Separation of duties maintained
- [ ] No overly permissive wildcard URIs
- [ ] Token validity reasonable (not too long)

### SAP CAP Compliance
- [ ] Follows BTP naming conventions
- [ ] Integrates with CAP authentication
- [ ] Supports profile-based mocked auth (development)
- [ ] Ready for XSUAA service binding (production)

---

## Automated Validation

```bash
# Validate JSON syntax
cat xs-security.json | jq empty && echo "✓ Valid JSON"

# Count scopes (should be 4)
jq '.scopes | length' xs-security.json

# Count role templates (should be 3)
jq '."role-templates" | length' xs-security.json

# Count role collections (should be 3)
jq '."role-collections" | length' xs-security.json

# Verify xsappname
jq -r '.xsappname' xs-security.json

# Check OAuth2 redirect URIs count
jq '."oauth2-configuration"."redirect-uris" | length' xs-security.json

# Validate all scopes have descriptions
jq '.scopes[] | select(.description == null or .description == "") | .name' xs-security.json
```

**Expected Output:**
```
✓ Valid JSON
4
3
3
supplier-onboarding
5
(empty - all scopes have descriptions)
```

---

## Manual Review Questions

1. **Scope Granularity**: Are the 4 scopes sufficient for all use cases?
   - Creating invitations ✓
   - Managing invitations ✓
   - Auditing ✓
   - Supplier onboarding (token-based) ✓

2. **Role Design**: Do role templates match org structure?
   - Purchaser (operational users) ✓
   - Admin (IT/process owners) ✓
   - Auditor (compliance team) ✓

3. **Attributes**: Are Department and CostCenter sufficient?
   - Enables organizational filtering ✓
   - Could extend with Region, BusinessUnit if needed

4. **Token Validity**: Is 12 hours appropriate?
   - Balances security (not too long) ✓
   - Balances usability (full work day) ✓

5. **Redirect URIs**: Are all deployment targets covered?
   - BAS ✓
   - Cloud Foundry ✓
   - Local development ✓
   - SAP Build Apps (will use API, not redirect) ✓

---

## Success Criteria

**Step 3 is complete when:**
1. ✅ xs-security.json passes JSON schema validation
2. ✅ All 4 scopes correctly defined
3. ✅ All 3 role templates configured with correct scope mappings
4. ✅ All 3 role collections reference correct templates
5. ✅ OAuth2 configuration covers all environments
6. ✅ ABAC attributes defined and used
7. ✅ No security best practice violations
8. ✅ Configuration ready for XSUAA service binding
9. ✅ Documentation updated with security decisions
10. ✅ All automated validation checks pass

---

## Next Steps After Validation

Once Step 3 passes:
- **Step 4**: Design CAP data model (entities with `cuid`, `managed`)
- **Step 5**: Create service definitions (single-purposed services)
- **Step 6**: Implement token generation logic
- Reference xs-security.json for `@requires` and `@restrict` annotations
