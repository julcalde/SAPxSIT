# Questions for SIT Experts

## Security & Authentication

**Q2: Session Binding Controls** ⏳ PENDING
- Do we need IP binding or device fingerprinting for external supplier sessions?

## Authorization & Identity Services

**Q3: Role Templates & Naming Conventions** ⏳ PENDING
- Are there required role templates/naming standards for supplier onboarding?

**Q4: Token Forwarding Policy** ⏳ PENDING
- Is CAP-to-CAP token forwarding allowed for internal ↔ external app communication?

## Audit, Logging, and Compliance

**Q5: Audit Logging Requirements** ⏳ PENDING
- Which onboarding events must be logged (invitation, OTP use, data submission, approval)?
- Required fields, PII handling, and retention period?

**Q6: Compliance Scope** ⏳ PENDING
- Which frameworks apply (GDPR, SOX, internal security policy)?

**Q7: Immutable Logs** ⏳ PENDING
- Is SAP Audit Log service required for immutable logs?

## Data Privacy & Storage

**Q8: Data Residency & Encryption** ⏳ PENDING
- Any regional residency constraints or encryption requirements for supplier data?

**Q9: Object Store Approval** ⏳ PENDING
- Is SAP BTP Object Store approved for attachments, and is customer-managed encryption required?

## Connectivity & Destinations

**Q10: Connectivity Service** ⏳ PENDING
- Is Connectivity service required (on‑premise access), or cloud‑to‑cloud only?

**Q11: Destination Standards** ⏳ PENDING
- Required naming conventions or destination templates for S/4HANA and Object Store?

**Q12: MTA Template Standard** ⏳ PENDING
- Is there a standard `mta.yaml` template to follow beyond `cds add xsuaa,destination,connectivity`?

## Operational & Recovery

**Q14: Re‑Invitation Policy** ⏳ PENDING
- Should the system auto‑reissue invitations or require manual re‑invite?

**Q15: SLAs & Lockout Windows** ⏳ PENDING
- Any SLA targets for onboarding completion or lockout duration?

## Testing & Environments

**Q17: Email OTP Testing** ⏳ PENDING
- Are external email OTP tests allowed in SIT (e.g., Gmail)?

**Q18: Test Data & Mock Services** ⏳ PENDING
- Are there approved test accounts, mock services, or datasets for SIT?

**Q19: Non‑Functional Testing** ⏳ PENDING
- Do you require load tests, security scans, or penetration testing before go‑live?
