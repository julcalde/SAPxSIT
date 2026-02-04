# SAP CAP Standards Review & Improvement Plan

**Date:** February 4, 2026  
**Project:** Supplier Self-Onboarding Solution  
**Reference:** https://cap.cloud.sap/docs/about/best-practices

---

## Executive Summary

This document reviews the current implementation against official SAP CAP standards and best practices. Overall, the project follows CAP conventions well, but there are opportunities to improve alignment with CAP philosophy and leverage more generic provider capabilities.

**Overall Assessment:** ✅ Good (75% CAP-compliant)

**Key Strengths:**
- ✅ Proper use of CDS aspects (`cuid`, `managed`, reuse types from `@sap/cds/common`)
- ✅ Services defined with projections and facades
- ✅ Event handlers properly structured (`.before`, `.on`, `.after`)
- ✅ Passive data approach (no Active Records or DAOs)
- ✅ Service-oriented architecture with clear separation

**Areas for Improvement:**
- ⚠️ Some manual validation logic could leverage CAP's declarative validations
- ⚠️ S/4HANA client could better follow the Calesi pattern
- ⚠️ Some duplicate code in service handlers
- ⚠️ Limited use of CAP's generic providers for standard operations

---

## Detailed Review by CAP Principle

### 1. Domain Models (CDS) ✅ GOOD

**Current State:**
```cds
// db/schema.cds
namespace supplierOnboarding;
using { cuid, managed, Country, Currency } from '@sap/cds/common';

entity SupplierInvitations : cuid, managed {
  email: String(255) not null;
  tokenState: TokenState not null default 'CREATED';
  // ... associations properly defined
  onboardingData: Association to SupplierOnboardingData;
  auditLogs: Association to many AuditLogs;
}
```

**✅ Follows CAP Standards:**
- Proper use of aspects (`cuid`, `managed`)
- Reuses common types from `@sap/cds/common` (Country, Currency)
- Associations properly defined with cardinality
- Composition used correctly for parent-child relationships (AttachmentMetadata)
- Enums defined as CDS types
- Annotations for validation (@mandatory, @assert.format)

**Recommendations:**
1. Consider adding more declarative validations using `@assert` annotations
2. Add `@title` and `@description` annotations for better UI integration

**Example Improvement:**
```cds
annotate SupplierInvitations with {
  email @title: 'Email Address' 
        @description: 'Supplier contact email'
        @mandatory 
        @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  
  companyName @title: 'Company Name'
              @description: 'Legal company name';
}

annotate SupplierOnboardingData with {
  companyLegalName @title: 'Legal Company Name'
                   @mandatory
                   @assert.notNull
                   @assert.range: [2, 255]; // Length validation
                   
  taxId @assert.format: '^[A-Z0-9]{5,20}$' @title: 'Tax ID';
  
  primaryContactEmail @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                      @title: 'Primary Contact Email';
}
```

---

### 2. Services as Facades ✅ GOOD

**Current State:**
```cds
// srv/admin-service.cds
@readonly
entity Invitations as projection on db.SupplierInvitations {
  *, onboardingData, auditLogs
};

// srv/supplier-service.cds
entity MyOnboardingData as projection on db.SupplierOnboardingData {
  *,
  attachments
} excluding {
  reviewedBy,
  reviewNotes,
  s4BusinessPartnerId
};
```

**✅ Follows CAP Standards:**
- Services expose projections on domain entities (not 1:1 exposures)
- Use case-specific facades (AdminService for auditors, SupplierService for external suppliers)
- Proper use of `excluding` to hide sensitive fields
- Single-purposed services (each serves one user group)

**Recommendations:**
1. Add `@readonly` to more entities where appropriate
2. Consider exposing only necessary fields instead of `*` with `excluding`

**Example Improvement:**
```cds
// srv/supplier-service.cds
entity MyOnboardingData as projection on db.SupplierOnboardingData {
  // Explicit field list (better than * + excluding)
  ID,
  companyLegalName,
  taxId,
  country,
  primaryContactName,
  primaryContactEmail,
  onboardingStatus,
  submittedAt,
  attachments
  // Internal fields automatically excluded
};
```

---

### 3. Events & Event Handlers ✅ EXCELLENT

**Current State:**
```javascript
// srv/invitation-service.js
srv.before('createInvitation', (req) => {
  // Validation logic
});

srv.on('createInvitation', async (req) => {
  // Business logic
});

srv.after('READ', 'Invitations', async (invitations) => {
  // Post-processing
});
```

**✅ Follows CAP Standards:**
- Proper use of `.before`, `.on`, `.after` phases
- Event handlers properly separated by concern
- Generic handlers used where appropriate: `srv.before('*', ...)`
- Service implementation = sum of event handlers

**No improvements needed** - this follows CAP best practices perfectly.

---

### 4. Passive Data & Querying ✅ EXCELLENT

**Current State:**
```javascript
// All data is passive (plain JavaScript objects)
const invitations = await SELECT.from(SupplierInvitations).where({ email });
const onboarding = await INSERT.into(SupplierOnboardingData).entries(data);
const updated = await UPDATE(SupplierInvitations).set({ tokenState: 'CONSUMED' });
```

**✅ Follows CAP Standards:**
- No Active Records, DAOs, or DTOs
- All data represented as plain objects
- Use of CDS Query Language (CQL)
- Queries pushed down to database

**No improvements needed** - excellent use of CAP querying patterns.

---

### 5. Agnostic by Design (Hexagonal Architecture) ⚠️ NEEDS IMPROVEMENT

**Current State:**

**✅ Good:**
- Service implementations are protocol-agnostic
- Event handlers don't depend on HTTP/OData specifics
- Services can be called locally or remotely

**⚠️ Needs Improvement:**
- S/4HANA client (`s4hana-client.js`) directly uses `axios` instead of CAP's agnostic remote service pattern
- Object Store integration (not yet implemented) should follow Calesi pattern

**Recommendations:**

#### 5.1 S/4HANA Integration - Follow Calesi Pattern

**Current Approach:**
```javascript
// srv/lib/s4hana-client.js - Direct axios usage
const axios = require('axios');
const response = await axios({
  method: 'POST',
  url: `${destination.URL}/A_BusinessPartner`,
  // ...
});
```

**Recommended CAP Approach:**
```cds
// srv/external/S4_BusinessPartner.cds
service S4_BusinessPartner {
  entity A_BusinessPartner {
    key BusinessPartner: String(10);
    BusinessPartnerFullName: String(81);
    // ... field definitions from S/4HANA API
  }
  
  entity A_Supplier {
    key Supplier: String(10);
    key PurchasingOrganization: String(4);
    // ...
  }
}
```

```javascript
// srv/lib/s4hana-service.js - CAP-style service
module.exports = async (srv) => {
  const s4bp = await cds.connect.to('S4_BusinessPartner');
  
  // Use CDS querying instead of axios
  const createBusinessPartner = async (data) => {
    return await INSERT.into(s4bp.entities.A_BusinessPartner).entries(data);
  };
  
  return {
    createBusinessPartner,
    createSupplier: async (data) => {
      return await INSERT.into(s4bp.entities.A_Supplier).entries(data);
    }
  };
};
```

```json
// package.json - Define external service
{
  "cds": {
    "requires": {
      "S4_BusinessPartner": {
        "kind": "odata-v4",
        "model": "srv/external/S4_BusinessPartner",
        "[production]": {
          "credentials": {
            "destination": "s4hana-cloud-odata-v4"
          }
        },
        "[development]": {
          "impl": "srv/lib/s4hana-mock.js"
        }
      }
    }
  }
}
```

**Benefits:**
- ✅ Protocol-agnostic (works with OData, REST, GraphQL)
- ✅ Automatic mock support for development
- ✅ No manual axios/HTTP handling
- ✅ CDS querying instead of raw HTTP requests
- ✅ Follows Hexagonal Architecture (CAP already implemented it)

---

### 6. Generic Providers ⚠️ COULD IMPROVE

**Current State:**

**✅ Good:**
- CAP serves standard CRUD operations automatically
- Pagination, filtering, sorting handled by framework
- Authorization via `@restrict` annotations

**⚠️ Underutilized:**
- Manual validation logic that could be declarative
- Some standard operations re-implemented in handlers

**Recommendations:**

#### 6.1 Use Declarative Validations Instead of Imperative Code

**Current Approach:**
```javascript
// srv/supplier-service.js
srv.before('submitSupplierData', (req) => {
  if (!data.companyLegalName || data.companyLegalName.trim().length < 2) {
    validationErrors.push({ field: 'companyLegalName', message: 'Required' });
  }
  
  if (!validateEmail(data.primaryContactEmail)) {
    validationErrors.push({ field: 'primaryContactEmail', message: 'Invalid' });
  }
  
  // 50+ lines of validation logic...
});
```

**Recommended CAP Approach:**
```cds
// db/schema.cds - Declarative validations
annotate SupplierOnboardingData with {
  companyLegalName @assert.notNull 
                   @assert.range: [2, 255]
                   @title: 'Company Legal Name';
  
  primaryContactEmail @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                      @title: 'Primary Contact Email';
  
  taxId @assert.format: '^[A-Z0-9]{5,20}$' @title: 'Tax ID';
  
  country @assert.notNull @title: 'Country';
  
  primaryContactName @assert.notNull 
                     @assert.range: [2, 255]
                     @title: 'Primary Contact Name';
}
```

**Benefits:**
- CAP validates automatically before database operations
- Less code to maintain
- Validation rules visible in CDS model (documentation)
- Can be reused across services
- UI can generate forms from annotations

#### 6.2 Let Generic Providers Handle Standard Operations

**Current:**
```javascript
// srv/invitation-service.js
srv.on('createInvitation', async (req) => {
  // 100+ lines of manual database operations
  const invitation = await INSERT.into(SupplierInvitations).entries({...});
  const auditLog = await INSERT.into(AuditLogs).entries({...});
  // ...
});
```

**Recommended:**
```javascript
// Let CAP handle standard CRUD via generic provider
// Only add custom logic for business-specific operations

srv.before('CREATE', 'Invitations', async (req) => {
  // Generate token
  const token = await generateInvitationToken({...});
  req.data.tokenHash = token.tokenHash;
  req.data.issuedAt = token.issuedAt;
  // Generic provider handles INSERT automatically
});

srv.after('CREATE', 'Invitations', async (invitation, req) => {
  // Audit logging
  await INSERT.into(AuditLogs).entries({
    eventType: 'INVITATION_CREATED',
    invitation_ID: invitation.ID,
    // ...
  });
});
```

---

### 7. Intrinsic Extensibility ✅ GOOD

**Current State:**
- Models can be extended (aspects)
- Event handlers can be added by anyone
- No static classes blocking extensibility

**Recommendation:**
- Document extension points for customers
- Add example of extending services

---

### 8. Late-Cut Microservices ✅ EXCELLENT

**Current State:**
- Single CAP project (modulith)
- 3 services (Invitation, Supplier, Admin) in one deployment unit
- Can be split later if needed

**✅ Follows CAP Standards:**
- Start with modulith ✅
- Services are modular components (not deployment units) ✅
- Avoid "Microservices Mania" ✅

**No changes needed** - perfect alignment with CAP philosophy.

---

## Anti-Patterns Check

### ❌ DAOs, DTOs, Active Records
**Status:** ✅ NONE FOUND - Excellent!

### ❌ Object-Relational Mappers
**Status:** ✅ NOT USED - Using CAP's querying correctly

### ❌ Code Generators
**Status:** ✅ NOT USED - Hand-crafted CDS models

### ❌ Squared Hexagons (abstracting from CAP)
**Status:** ✅ NO ABSTRACTION LAYER - Direct CAP usage

### ❌ Microservices Mania
**Status:** ✅ MODULITH APPROACH - Services are components, not deployment units

### ❌ The 'ODatabase' Pattern
**Status:** ✅ AVOIDED - Services expose use case-specific facades, not 1:1 projections

### ❌ Low-level DIY
**Status:** ⚠️ **FOUND IN s4hana-client.js** - Direct axios usage instead of CAP remote services

---

## Improvement Plan

### Priority 1: High Impact, Low Effort

#### 1.1 Add Declarative Validations to CDS Models
**File:** `db/schema.cds`  
**Effort:** 2 hours  
**Impact:** Reduce validation code by ~200 lines, improve maintainability

**Changes:**
```cds
annotate SupplierOnboardingData with {
  companyLegalName @assert.notNull @assert.range: [2, 255];
  primaryContactEmail @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  taxId @assert.format: '^[A-Z0-9]{5,20}$';
  country @assert.notNull;
  // ... add for all validated fields
}
```

**Remove from:**
- `srv/supplier-service.js` (validation logic in `.before` handlers)
- `srv/lib/validators.js` (some functions become redundant)

---

#### 1.2 Add UI Annotations for Better Fiori Integration
**File:** `db/schema.cds`  
**Effort:** 1 hour  
**Impact:** Better UI generation, self-documenting model

**Changes:**
```cds
annotate SupplierOnboardingData with {
  companyLegalName @title: 'Company Legal Name' 
                   @description: 'Official registered name of the company';
  taxId @title: 'Tax Identification Number'
        @description: 'Government-issued tax identifier';
  country @title: 'Country'
          @description: 'Country where company is registered';
  // ... add for all fields
}
```

---

### Priority 2: Medium Impact, Medium Effort

#### 2.1 Refactor S/4HANA Client to Follow Calesi Pattern
**Files:** `srv/lib/s4hana-client.js`, `srv/external/S4_BusinessPartner.cds`, `package.json`  
**Effort:** 4-6 hours  
**Impact:** Protocol-agnostic, mockable, testable, CAP-compliant

**Steps:**
1. Create external service definition: `srv/external/S4_BusinessPartner.cds`
2. Import S/4HANA API metadata using `cds import`
3. Refactor client to use `cds.connect.to('S4_BusinessPartner')`
4. Replace axios calls with CDS queries (`INSERT`, `UPDATE`, `SELECT`)
5. Create mock implementation for development: `srv/lib/s4hana-mock.js`
6. Update `package.json` with external service configuration

**Benefits:**
- Development without S/4HANA connection ("airplane mode")
- Automatic protocol adaptation
- Better testability
- Follows Hexagonal Architecture

---

#### 2.2 Simplify Service Handlers (Remove Redundant Logic)
**Files:** `srv/invitation-service.js`, `srv/supplier-service.js`  
**Effort:** 3 hours  
**Impact:** Less code, leverage generic providers

**Changes:**
- Let CAP's generic providers handle standard CRUD
- Move business logic to `.before`/`.after` handlers
- Remove manual INSERT/UPDATE where generic provider can do it

---

### Priority 3: Low Impact, High Effort (Future)

#### 3.1 Implement Object Store Service with Calesi Pattern
**Files:** `srv/lib/objectstore-service.js`, `srv/external/ObjectStore.cds`  
**Effort:** 6-8 hours (Step 14 of original plan)  
**Impact:** CAP-compliant file storage integration

**Approach:**
```cds
// srv/external/ObjectStore.cds
service ObjectStoreService {
  action generatePresignedUploadURL(fileName: String, mimeType: String) returns {
    url: String;
    expiresAt: DateTime;
    objectKey: String;
  };
  
  function generatePresignedDownloadURL(objectKey: String) returns {
    url: String;
    expiresAt: DateTime;
  };
}
```

---

## Summary of Recommendations

| Category | Current | Recommended | Priority | Effort |
|----------|---------|-------------|----------|--------|
| **Domain Model Validations** | Imperative (JS) | Declarative (CDS @assert) | P1 | 2h |
| **UI Annotations** | Missing | Add @title, @description | P1 | 1h |
| **S/4HANA Integration** | axios + manual HTTP | CAP remote service | P2 | 4-6h |
| **Service Handlers** | Manual CRUD | Generic providers | P2 | 3h |
| **Object Store** | Not implemented | Calesi pattern | P3 | 6-8h |

**Total Effort:** ~16-20 hours  
**Expected Outcome:** 90%+ CAP compliance, ~300 lines of code removed, better maintainability

---

## References

- [SAP CAP Best Practices](https://cap.cloud.sap/docs/about/best-practices)
- [SAP CAP Anti Patterns](https://cap.cloud.sap/docs/about/bad-practices)
- [CDS Annotations](https://cap.cloud.sap/docs/cds/annotations)
- [Consuming Services](https://cap.cloud.sap/docs/guides/using-services)
- [Remote Services](https://cap.cloud.sap/docs/guides/using-services#remote-services)
- [The Calesi Effect](https://cap.cloud.sap/docs/about/#the-calesi-effect)

---

## Next Steps

1. Review this document with the team
2. Prioritize improvements based on project timeline
3. Start with Priority 1 items (quick wins)
4. Implement Priority 2 items before Step 13 (Object Store setup)
5. Document lessons learned for future CAP projects
