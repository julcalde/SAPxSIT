# Questions for SIT Experts

## Security & Authentication

**Q1: 2FA/OTP Method** ✅ ANSWERED
- **User Answer:** Email-based OTP; mock tests planned with team Gmail
- **Implication:** Use CAP-integrated email service + SMTP relay to corporate mail system (production)

**Q2: 2FA Mandatory** ✅ ANSWERED
- **User Answer:** Optional but strongly recommended; good security practice without compromising simplicity
- **Implication:** Implement as feature toggle; enable by default but allow opt-out; monitor adoption

**Q3: Session Timeout (TTL)** ⏳ PENDING
- What are the required session timeout standards for external users?
- **TTL = Time To Live:** How long a session/token remains valid before re-login required
- Typical range: 15 min (high security) to 8 hours (high UX)
- **Note:** Consider operational impact (supplier logging back in repeatedly)

**Q4: Token TTL for API Calls** ✅ ANSWERED
- **User Answer:** Flexible; can choose as long as justified in documentation
- **Recommendation:** 15-30 minutes (CAP auto-refreshes transparently); justify in PoA security section

**Q5: IP Binding / Device Fingerprinting** ⏳ PENDING
- Do we need to enforce IP binding, device fingerprinting, or geolocation checks?
- **Pro:** Extra security layer; token not usable from other IPs/devices
- **Con:** Friction for mobile/VPN users; added complexity

## Authorization & Identity Services

**Q6: XSUAA vs IAS vs AMS** ℹ️ CLARIFIED
- **XSUAA:** Cloud Foundry built-in, standard MTA binding, role-based access, **lowest cost**
  - Best for: Standard supplier roles (View Invitations, Submit Documents, etc.)
- **IAS:** Enterprise Identity Authentication, advanced SSO/MFA, custom policies, **higher cost**
  - Best for: Corporate SSO integration, advanced MFA requirements
- **AMS:** Authorization Management Service, fine-grained permissions, newer, **complex hierarchies**
  - Best for: Complex delegation chains, dynamic permission evaluation
- **Agent's Recommendation:** **XSUAA** for supplier onboarding (sufficient + cost-effective; can switch later if needed)
- **Next Step:** Confirm choice with SIT; no need to decide before PoA approval

**Q7: Role Templates & Naming Conventions** ⏳ PENDING
- Are there existing role templates or naming conventions we must follow?

**Q8: Token Forwarding Policy** ⏳ PENDING
- Is token forwarding between CAP services allowed when using same XSUAA instance?
- **Note:** Official CAP guidance supports `forwardAuthToken: true` for same-XSUAA CAP-to-CAP calls

## Audit, Logging, and Compliance

**Q9: Audit Logging Requirements** ⏳ PENDING
- What audit logging is required for supplier onboarding events?
- **To clarify with SIT:** Fields required, PII handling, retention period

**Q10: Compliance Frameworks** ⏳ PENDING
- Which compliance frameworks apply (GDPR, SOX, industry-specific)?

**Q11: Immutable Logs** ⏳ PENDING
- Are there requirements for immutable logs or SAP Audit Log service integration?

## Data Privacy & Storage

**Q12: Data Residency & Encryption** ⏳ PENDING
- Are there data residency or encryption requirements for supplier data and attachments?

**Q13: Object Store Approval** ⏳ PENDING
- Is SAP BTP Object Store approved for storing sensitive attachments?
- **Note:** S3-compatible service; supports encryption and presigned URLs for secure client uploads

## Connectivity & Destinations

**Q14: Connectivity Service** ⏳ PENDING
- Do we need Connectivity service (on-premise access), or cloud-to-cloud only?
- **Note:** S/4HANA Cloud OData API is cloud-based; on-premise only if legacy systems involved

**Q15: Destination Naming Conventions** ⏳ PENDING
- What destination naming conventions and foldering standards are mandated?

**Q16: MTA Templates** ⏳ PENDING
- Are there approved destination templates or standard mta.yaml we must align with?
- **Note:** Official CAP pattern: `cds add xsuaa,destination,connectivity` auto-generates mta.yaml

## Operational & Recovery

**Q17: OTP Exhaustion Recovery** ⏳ PENDING
- What is the approved recovery flow if a supplier exhausts OTP attempts or token uses?

**Q18: Auto Re-Invite Policy** ⏳ PENDING
- Should the system auto-reissue invitations, or must a manager manually re-invite?

**Q19: SLAs & Lockout Windows** ⏳ PENDING
- Are there SLAs for onboarding completion or lockout windows we must enforce?

## Testing & Environments

**Q20: SMS/OTP Testing Restrictions** ⏳ PENDING
- Do SIT environments have restrictions on SMS/OTP testing or external email delivery?

**Q21: Test Data & Mock Services** ⏳ PENDING
- Are there specific test accounts, mock services, or data sets we should use?
- **Note:** User is planning to use team Gmail for email OTP testing

**Q22: Non-Functional Testing** ⏳ PENDING
- Do you require additional non-functional tests (load, security scans, pen testing) before go-live?
