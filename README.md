# Supplier Self-Onboarding Solution

[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![SAP CAP](https://img.shields.io/badge/SAP%20CAP-7.5-blue.svg)](https://cap.cloud.sap)

Production-grade, secure supplier self-onboarding solution for SAP BTP with S/4HANA Cloud integration.

---

## 🎯 Business Value

Enable external suppliers to self-register via secure, time-limited magic links without requiring BTP accounts. Internal purchasers generate invitation links, suppliers fill multi-page forms, and data automatically syncs to S/4HANA Cloud Business Partner and Supplier APIs.

### Key Features

- 🔐 **Security-First**: JWT magic links (7-day expiry), single-use tokens, rate limiting, XSUAA role-based access
- 📋 **Multi-Page Wizard**: Fiori Horizon-themed form (company data, contacts, bank details, certifications, file uploads)
- 🔄 **S/4HANA Integration**: OData V4 Business Partner & Supplier API creation via destinations
- 📎 **Document Storage**: Secure file uploads to SAP BTP Object Store (S3) via presigned URLs
- 📊 **Audit Trail**: Complete logging of all invitation and submission events (7-year retention)
- ♿ **GDPR Compliant**: Data minimization, 90-day retention, right to access/erasure

---

## 🏗️ Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         SAP BTP Environment                     │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐    │
│  │  Build Apps  │───▶│  CAP Service │───▶│  S/4HANA Cloud  │    │
│  │  (Supplier   │    │  (Node.js)   │    │  (OData V4)     │    │
│  │   Frontend)  │    │              │    │                 │    │
│  └──────────────┘    └──────┬───────┘    └─────────────────┘    │
│                              │                                  │
│                              ▼                                  │
│                      ┌──────────────┐                           │
│                      │  HANA Cloud  │                           │
│                      │  (Database)  │                           │
│                      └──────────────┘                           │
│                              │                                  │
│                              ▼                                  │
│                      ┌──────────────┐                           │
│                      │ Object Store │                           │
│                      │    (S3)      │                           │
│                      └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Backend**: SAP Cloud Application Programming Model (CAP) - Node.js
- **Database**: SAP HANA Cloud
- **Authentication**: XSUAA + IAS (optional)
- **Frontend**: SAP Build Apps (low-code)
- **File Storage**: SAP BTP Object Store (S3-compatible)
- **Integration**: S/4HANA Cloud Public Edition (OData V4)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ and npm 9+
- **[SAP CAP Development Kit](https://cap.cloud.sap/docs/get-started/)**: `npm i -g @sap/cds-dk`
- [SQLite](https://sqlite.org/) for local development
- SAP BTP account with Cloud Foundry enabled
- SAP HANA Cloud instance
- S/4HANA Cloud Public Edition tenant
- Cloud Foundry CLI (`cf`)
- MTA Build Tool (`mbt`)

### Installation

1. **Clone repository**
   ```bash
   git clone https://github.com/your-org/supplier-onboarding.git
   cd supplier-onboarding
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Deploy local database (SQLite)**
   ```bash
   cds deploy --to sqlite
   # or: npm run db:deploy:local
   ```

4. **Start development server with auto-reload**
   ```bash
   cds watch
   # or: npm run watch
   ```

   Server runs at: http://localhost:4004

### SAP CAP Quick Commands

Following [SAP CAP conventions](https://cap.cloud.sap/docs/):

```bash
# Development
cds watch                    # Start with live reload (recommended)
cds serve                    # Start server
cds deploy --to sqlite       # Deploy to local SQLite

# Testing
npm test                     # Run all tests
npm run test:coverage        # With coverage report

# Production Build
cds build                    # Build for production
npm run deploy               # Deploy to BTP
```

---

## 📁 Project Structure

```
supplier-onboarding/
├── app/                      # SAP Build Apps (external reference)
├── db/                       # Database schema (CDS models)
│   ├── schema.cds            # Main data model
│   └── data/                 # Sample data (CSV)
├── srv/                      # Service layer
│   ├── invitation-service.cds
│   ├── invitation-service.js
│   ├── supplier-service.cds
│   ├── supplier-service.js
│   └── lib/                  # Utility libraries
│       ├── token-manager.js
│       ├── token-validator.js
│       ├── s4hana-client.js
│       ├── objectstore-client.js
│       ├── crypto-utils.js
│       └── validators.js
├── test/                     # Test suite
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   └── fixtures/             # Test data
├── docs/                     # Documentation
│   ├── security-architecture.md
│   ├── api-reference.md
│   └── deployment-guide.md
├── scripts/                  # Automation scripts
│   ├── setup-btp.sh
│   └── deploy.sh
├── env/                      # Environment configs
│   └── .env.template
├── package.json
├── mta.yaml                  # Multi-Target Application descriptor
├── xs-security.json          # XSUAA security configuration
└── README.md
```

---

## 🔧 Development

### Run Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Linting & Formatting

```bash
# Run ESLint
npm run lint

# Fix lint issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Database Operations

```bash
# Deploy to local SQLite
npm run db:deploy:local

# Deploy to HANA Cloud
npm run db:deploy
```

---

## 🚢 Deployment

### Build MTA Archive

```bash
npm run build
mbt build
```

### Deploy to SAP BTP

```bash
cf login -a https://api.cf.eu10.hana.ondemand.com
cf target -o <your-org> -s <your-space>
npm run deploy
```

### Post-Deployment Steps

1. **Configure Destinations** (BTP Cockpit)
   - `s4hana-cloud-odata-v4` (S/4HANA Cloud)
   - `objectstore-s3-endpoint` (Object Store)

2. **Assign Role Collections** (BTP Cockpit → Security → Users)
   - `supplier-onboarding-purchaser-rc`
   - `supplier-onboarding-admin-rc`
   - `supplier-onboarding-auditor-rc`

3. **Verify Services**
   ```bash
   cf services
   ```

4. **Test API**
   ```bash
   curl https://<app-url>/api/health
   ```

---

## 🔐 Security

### Token Lifecycle

1. **CREATED** → Purchaser generates invitation
2. **SENT** → Link shared with supplier (manual)
3. **ACCESSED** → Supplier opens link
4. **IN_PROGRESS** → Form being filled (draft saves)
5. **SUBMITTED** → Final submission processing
6. **CONSUMED** → Successfully completed

### Security Controls

- JWT tokens with RS256 signature
- 7-day expiry (configurable)
- Single-use enforcement via state machine
- Rate limiting (5 validations/token/hour, 20 requests/IP/hour)
- HTTPS only (HSTS headers)
- CORS whitelisting
- Input validation & sanitization
- CSRF protection

See [docs/security-architecture.md](docs/security-architecture.md) for details.

---

## 📊 API Endpoints

### Internal User Endpoints (XSUAA Protected)

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/api/invitations` | POST | `invitation.create` | Create new invitation |
| `/api/invitations` | GET | `invitation.create` | List own invitations |
| `/api/invitations/{id}` | GET | `invitation.manage` | Get invitation details |
| `/api/invitations/{id}/revoke` | PATCH | `invitation.manage` | Revoke invitation |
| `/api/audit-logs` | GET | `invitation.audit` | Query audit logs |

### External Supplier Endpoints (Token-Based)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/validate-token` | GET | Validate magic link token |
| `/api/supplier-data` | POST | Submit supplier onboarding data |
| `/api/presigned-url` | POST | Get S3 presigned upload URL |
| `/api/drafts` | GET/PATCH | Save/load form drafts |

---

## 🧪 Testing

### Coverage Targets

- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### Test Structure

```
test/
├── unit/
│   ├── token-manager.test.js
│   ├── token-validator.test.js
│   ├── crypto-utils.test.js
│   └── validators.test.js
├── integration/
│   ├── invitation-service.test.js
│   ├── supplier-service.test.js
│   └── s4hana-integration.test.js
└── fixtures/
    ├── sample-token.json
    └── sample-supplier-data.json
```

---

## 📝 Environment Variables

See [env/.env.template](env/.env.template) for complete list.

Key variables:

```bash
# JWT Configuration
JWT_ISSUER=supplier-onboarding-cap
JWT_AUDIENCE=supplier-onboarding-app
JWT_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_TOKEN_MAX=5
RATE_LIMIT_IP_MAX=20

# S/4HANA Integration
S4_DESTINATION_NAME=s4hana-cloud-odata-v4

# Object Store
OBJECTSTORE_BUCKET=onboarding-documents
OBJECTSTORE_PRESIGNED_URL_EXPIRY_UPLOAD=900
```

---

## 📖 Documentation

- [Security Architecture](docs/security-architecture.md)
- [API Reference](docs/api-reference.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Test Plan - Step 1](docs/test-plan-step1.md)

---

## 🤝 Contributing

1. Create feature branch (`git checkout -b feature/amazing-feature`)
2. Commit changes (`git commit -m 'Add amazing feature'`)
3. Push to branch (`git push origin feature/amazing-feature`)
4. Open Pull Request

### Code Quality Standards

- All tests must pass (`npm test`)
- Lint-free code (`npm run lint`)
- Formatted code (`npm run format`)
- Coverage ≥ 70%

---

## 📄 License

UNLICENSED - Internal use only.

---

## 🆘 Support

For issues or questions:
- Create GitHub issue
- Contact: sap-btp-team@example.com
- Slack: #supplier-onboarding

---

## 🏆 Acknowledgments

Built with:
- [SAP Cloud Application Programming Model (CAP)](https://cap.cloud.sap)
- [SAP HANA Cloud](https://www.sap.com/products/hana/cloud.html)
- [SAP Build Apps](https://www.sap.com/products/build-apps.html)

---

**Version**: 1.0.0  
**Last Updated**: 2026-02-03
