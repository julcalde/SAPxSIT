# Supplier Self-Onboarding Solution

A complete, production-grade, secure supplier self-onboarding solution built with SAP Cloud Application Programming Model (CAP).

## Project Structure

```
supplier-onboarding/
├─ app/          # UI-related content (SAP Build Apps integration)
├─ srv/          # Service-related content (CAP services)
├─ db/           # Domain models and database-related content
├─ package.json  # Configuration for cds + cds-dk
├─ guidelines.md # Development guidelines and AI prompt best practices
└─ readme.md     # This file
```

## Business Flow

1. **Internal key user** triggers generation of a secure, single-use, time-limited onboarding invitation link
2. **Link generation** (email sending is NOT in scope)
3. **Supplier authentication** via short-lived token → Fiori Horizon styled multi-page form (SAP Build Apps)
4. **Supplier data entry**: company data, contacts, payment details, attachments
5. **Data submission**:
   - Core supplier/business partner data → S/4HANA Cloud via released OData API
   - Attachments → SAP BTP Object Store using pre-signed URLs
   - Status/history records in HANA Cloud

## Getting Started

### Prerequisites

- Node.js (LTS version)
- @sap/cds-dk (SAP Cloud Application Programming Model CLI)
- SAP BTP account with entitlements for:
  - HANA Cloud
  - Object Store
  - XSUAA
  - Destination service
  - S/4HANA Cloud integration

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

This will start the CAP server in development mode with SQLite in-memory database.

## Security Architecture

- **Short-lived tokens** (max 15 minutes TTL)
- **Single-use invitation links** with token validation
- **XSUAA-based authentication** with proper scope/audience validation
- **Pre-signed URLs** for secure file uploads to Object Store
- **Least privilege principle** throughout the solution

## Reference

See [guidelines.md](guidelines.md) for detailed development guidelines and best practices.

For SAP CAP documentation: https://cap.cloud.sap/docs/
