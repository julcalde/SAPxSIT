# Test Suite

This directory contains all automated tests for the Supplier Self-Onboarding application.

## Structure

```
test/
├── unit/              # Unit tests for individual components
│   ├── services/      # Service layer tests
│   ├── handlers/      # Event handler tests
│   └── utils/         # Utility function tests
├── integration/       # Integration tests
│   ├── api/           # API endpoint tests
│   ├── db/            # Database integration tests
│   └── services/      # Service integration tests
└── fixtures/          # Test data and fixtures
```

## Running Tests

Following SAP CAP testing best practices:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode (re-run on changes)
npm run test:watch
```

## Test Framework

- **Jest** - Primary testing framework
- **Supertest** - HTTP assertion library
- **@sap/cds/test** - CAP testing utilities (when implemented)

## Coverage Requirements

Minimum coverage thresholds (configured in package.json):
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Writing Tests

Follow SAP CAP testing patterns:

```javascript
const cds = require('@sap/cds/lib');
const { GET, POST, PUT, DELETE } = cds.test(__dirname + '/..');

describe('InvitationService', () => {
  test('should create invitation', async () => {
    const { status, data } = await POST('/invitation-service/Invitations', {
      supplierEmail: 'test@example.com',
      companyName: 'Test Corp'
    });
    
    expect(status).toBe(201);
    expect(data).toHaveProperty('ID');
  });
});
```

## Test Data

Test fixtures are stored in `test/fixtures/` and follow the same structure as production data models.
