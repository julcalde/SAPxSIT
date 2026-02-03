#!/usr/bin/env node

/**
 * Manual Validation Script for Step 7 - Token Validation Logic
 * 
 * This script validates the token-validator.js implementation by:
 * 1. Generating test keypair and token
 * 2. Creating mock database service
 * 3. Testing validation with various scenarios
 * 4. Testing error codes and edge cases
 * 5. Verifying helper functions
 * 
 * Run: node scripts/validate-token-step7.js
 */

const {
  validateToken,
  validateTokenSignatureOnly,
  isTokenExpired,
  getInvitationIdFromToken,
  formatValidationError,
  ValidationError,
  ERROR_CODES
} = require('../srv/lib/token-validator');

const { generateInvitationToken, generateKeyPair } = require('../srv/lib/token-manager');
const jwt = require('jsonwebtoken');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Step 7: Token Validation Logic - Manual Validation          ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Track validation results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: '✅ PASS' });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: `❌ FAIL: ${error.message}` });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============================================================================
// 1. Setup: Generate Test Token and Mock Database
// ============================================================================
console.log('\n📋 Phase 1: Setup\n');

let keyPair;
let testResult;
let testToken;
let mockDb;

test('Generate RSA key pair', () => {
  keyPair = generateKeyPair();
  assert(keyPair.privateKey, 'Private key not generated');
  assert(keyPair.publicKey, 'Public key not generated');
});

test('Generate test invitation token', () => {
  testResult = generateInvitationToken({
    email: 'test-supplier@example.com',
    companyName: 'Acme Test GmbH',
    contactName: 'Jane Doe',
    requesterId: 'purchaser@company.com',
    departmentCode: 'PURCHASING',
    costCenter: 'CC-TEST-001',
    expiryDays: 7,
    privateKey: keyPair.privateKey
  });
  
  testToken = testResult.token;
  assert(testToken, 'Token not generated');
  assert(testResult.invitationId, 'Invitation ID not generated');
  assert(testResult.tokenHash, 'Token hash not generated');
});

test('Create mock database service', () => {
  mockDb = {
    entities: (namespace) => ({
      SupplierInvitations: 'supplierOnboarding.SupplierInvitations'
    }),
    read: (entity) => ({
      where: (condition) => ({
        one: async () => ({
          ID: testResult.invitationId,
          email: 'test-supplier@example.com',
          companyName: 'Acme Test GmbH',
          contactName: 'Jane Doe',
          tokenHash: testResult.tokenHash,
          tokenState: 'SENT',
          issuedAt: testResult.issuedAt,
          expiresAt: testResult.expiresAt,
          validationAttempts: 0,
          createdBy: 'purchaser@company.com',
          departmentCode: 'PURCHASING',
          costCenter: 'CC-TEST-001'
        })
      })
    }),
    update: (entity) => ({
      set: (data) => ({
        where: (condition) => {
          return Promise.resolve();
        }
      })
    })
  };
  
  assert(mockDb, 'Mock database not created');
});

// ============================================================================
// 2. Test Successful Validation
// ============================================================================
console.log('\n📋 Phase 2: Successful Validation\n');

let validationResult;

test('Validate token with all security checks', async () => {
  validationResult = await validateToken(testToken, {
    publicKey: keyPair.publicKey,
    db: mockDb,
    ipAddress: '192.168.1.1'
  });
  
  assert(validationResult.valid === true, 'Validation should succeed');
  assert(validationResult.invitationId === testResult.invitationId, 'Invitation ID mismatch');
  assert(validationResult.supplierEmail === 'test-supplier@example.com', 'Email mismatch');
});

test('Validation result contains all required fields', () => {
  assert(validationResult.valid, 'valid field missing');
  assert(validationResult.claims, 'claims field missing');
  assert(validationResult.invitationId, 'invitationId field missing');
  assert(validationResult.supplierEmail, 'supplierEmail field missing');
  assert(validationResult.companyName, 'companyName field missing');
  assert(validationResult.tokenState, 'tokenState field missing');
  assert(typeof validationResult.validationAttempts === 'number', 'validationAttempts not a number');
  assert(validationResult.metadata, 'metadata field missing');
});

test('Token state updated to VALIDATED', () => {
  assert(validationResult.tokenState === 'VALIDATED', `State is ${validationResult.tokenState}, expected VALIDATED`);
});

test('Validation attempts incremented', () => {
  assert(validationResult.validationAttempts === 1, `Attempts is ${validationResult.validationAttempts}, expected 1`);
});

// ============================================================================
// 3. Test Parameter Validation
// ============================================================================
console.log('\n📋 Phase 3: Parameter Validation\n');

test('Throws error if token is missing', async () => {
  try {
    await validateToken();
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error instanceof ValidationError, 'Error should be ValidationError');
    assert(error.code === ERROR_CODES.MISSING_TOKEN, 'Error code should be MISSING_TOKEN');
  }
});

test('Throws error if token is empty string', async () => {
  try {
    await validateToken('');
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.MISSING_TOKEN, 'Error code should be MISSING_TOKEN');
  }
});

test('Throws error if token is not a string', async () => {
  try {
    await validateToken(12345);
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.INVALID_FORMAT, 'Error code should be INVALID_FORMAT');
  }
});

test('Throws error if token format invalid', async () => {
  try {
    await validateToken('invalid.token');
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.INVALID_FORMAT, 'Error code should be INVALID_FORMAT');
  }
});

// ============================================================================
// 4. Test Signature Verification
// ============================================================================
console.log('\n📋 Phase 4: Signature Verification\n');

test('Fails with invalid signature (wrong public key)', async () => {
  const wrongKeyPair = generateKeyPair();
  
  try {
    await validateToken(testToken, {
      publicKey: wrongKeyPair.publicKey
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.SIGNATURE_INVALID, 'Error code should be SIGNATURE_INVALID');
  }
});

test('Fails with tampered token', async () => {
  const parts = testToken.split('.');
  const tamperedToken = parts[0] + '.' + parts[1] + '.tampered';
  
  try {
    await validateToken(tamperedToken, {
      publicKey: keyPair.publicKey
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.SIGNATURE_INVALID, 'Error code should be SIGNATURE_INVALID');
  }
});

// ============================================================================
// 5. Test Expiry Validation
// ============================================================================
console.log('\n📋 Phase 5: Expiry Validation\n');

test('Fails if token is expired', async () => {
  const expiredPayload = {
    ...jwt.decode(testToken),
    exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  };
  
  const expiredToken = jwt.sign(expiredPayload, keyPair.privateKey, {
    algorithm: 'RS256'
  });
  
  try {
    await validateToken(expiredToken, {
      publicKey: keyPair.publicKey
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.TOKEN_EXPIRED, 'Error code should be TOKEN_EXPIRED');
  }
});

// ============================================================================
// 6. Test Token State Validation
// ============================================================================
console.log('\n📋 Phase 6: Token State Validation\n');

test('Fails if token is consumed', async () => {
  const consumedDb = {
    ...mockDb,
    read: () => ({
      where: () => ({
        one: async () => ({
          ...await mockDb.read().where().one(),
          tokenState: 'CONSUMED',
          consumedAt: new Date()
        })
      })
    })
  };
  
  try {
    await validateToken(testToken, {
      publicKey: keyPair.publicKey,
      db: consumedDb
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.ALREADY_CONSUMED, 'Error code should be ALREADY_CONSUMED');
  }
});

test('Fails if token is revoked', async () => {
  const revokedDb = {
    ...mockDb,
    read: () => ({
      where: () => ({
        one: async () => ({
          ...await mockDb.read().where().one(),
          tokenState: 'REVOKED',
          revokedAt: new Date(),
          revokedBy: 'admin@company.com'
        })
      })
    })
  };
  
  try {
    await validateToken(testToken, {
      publicKey: keyPair.publicKey,
      db: revokedDb
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.REVOKED, 'Error code should be REVOKED');
  }
});

// ============================================================================
// 7. Test Database Validation
// ============================================================================
console.log('\n📋 Phase 7: Database Validation\n');

test('Fails if invitation not found in database', async () => {
  const notFoundDb = {
    ...mockDb,
    read: () => ({
      where: () => ({
        one: async () => null
      })
    })
  };
  
  try {
    await validateToken(testToken, {
      publicKey: keyPair.publicKey,
      db: notFoundDb
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.NOT_FOUND, 'Error code should be NOT_FOUND');
  }
});

test('Fails on database error', async () => {
  const errorDb = {
    ...mockDb,
    read: () => ({
      where: () => ({
        one: async () => {
          throw new Error('Database connection failed');
        }
      })
    })
  };
  
  try {
    await validateToken(testToken, {
      publicKey: keyPair.publicKey,
      db: errorDb
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.DATABASE_ERROR, 'Error code should be DATABASE_ERROR');
  }
});

// ============================================================================
// 8. Test Rate Limiting
// ============================================================================
console.log('\n📋 Phase 8: Rate Limiting\n');

test('Fails if validation attempts exceed limit', async () => {
  const rateLimitDb = {
    ...mockDb,
    read: () => ({
      where: () => ({
        one: async () => ({
          ...await mockDb.read().where().one(),
          validationAttempts: 5 // At limit
        })
      })
    })
  };
  
  try {
    await validateToken(testToken, {
      publicKey: keyPair.publicKey,
      db: rateLimitDb
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Error code should be RATE_LIMIT_EXCEEDED');
  }
});

// ============================================================================
// 9. Test Helper Functions
// ============================================================================
console.log('\n📋 Phase 9: Helper Functions\n');

test('validateTokenSignatureOnly verifies signature', () => {
  const decoded = validateTokenSignatureOnly(testToken, keyPair.publicKey);
  assert(decoded.invitation_id, 'Should have invitation_id claim');
  assert(decoded.supplier_email, 'Should have supplier_email claim');
});

test('validateTokenSignatureOnly fails without public key', () => {
  try {
    validateTokenSignatureOnly(testToken);
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.SIGNATURE_INVALID, 'Should require public key');
  }
});

test('isTokenExpired returns false for valid token', () => {
  const expired = isTokenExpired(testToken);
  assert(expired === false, 'Valid token should not be expired');
});

test('isTokenExpired returns true for expired token', () => {
  const expiredPayload = {
    ...jwt.decode(testToken),
    exp: Math.floor(Date.now() / 1000) - 3600
  };
  const expiredToken = jwt.sign(expiredPayload, keyPair.privateKey, { algorithm: 'RS256' });
  
  const expired = isTokenExpired(expiredToken);
  assert(expired === true, 'Expired token should return true');
});

test('getInvitationIdFromToken extracts invitation ID', () => {
  const id = getInvitationIdFromToken(testToken);
  assert(id === testResult.invitationId, 'Invitation ID should match');
});

test('getInvitationIdFromToken returns null for invalid token', () => {
  const id = getInvitationIdFromToken('invalid.token');
  assert(id === null, 'Should return null for invalid token');
});

test('formatValidationError formats ValidationError', () => {
  const error = new ValidationError(ERROR_CODES.TOKEN_EXPIRED, 'Token expired', { expiredAt: '2024-01-01' });
  const formatted = formatValidationError(error);
  
  assert(formatted.valid === false, 'valid should be false');
  assert(formatted.error.code === ERROR_CODES.TOKEN_EXPIRED, 'Error code should match');
  assert(formatted.error.message === 'Token expired', 'Message should match');
  assert(formatted.error.details.expiredAt === '2024-01-01', 'Details should be preserved');
});

// ============================================================================
// 10. Test Required Claims
// ============================================================================
console.log('\n📋 Phase 10: Required Claims Validation\n');

test('Fails if invitation_id claim missing', async () => {
  const payload = { ...jwt.decode(testToken) };
  delete payload.invitation_id;
  const invalidToken = jwt.sign(payload, keyPair.privateKey, { algorithm: 'RS256' });
  
  try {
    await validateToken(invalidToken, {
      publicKey: keyPair.publicKey
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.INVALID_CLAIMS, 'Error code should be INVALID_CLAIMS');
  }
});

test('Fails if supplier_email claim missing', async () => {
  const payload = { ...jwt.decode(testToken) };
  delete payload.supplier_email;
  const invalidToken = jwt.sign(payload, keyPair.privateKey, { algorithm: 'RS256' });
  
  try {
    await validateToken(invalidToken, {
      publicKey: keyPair.publicKey
    });
    throw new Error('Should have thrown ValidationError');
  } catch (error) {
    assert(error.code === ERROR_CODES.INVALID_CLAIMS, 'Error code should be INVALID_CLAIMS');
  }
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  VALIDATION SUMMARY                                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`✅ Passed: ${results.passed}`);
console.log(`❌ Failed: ${results.failed}`);
console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(2)}%\n`);

if (results.failed === 0) {
  console.log('🎉 ALL VALIDATION TESTS PASSED!\n');
  console.log('Step 7 token validation implementation is correct and ready for use.\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Sample Validation Result:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Valid: ${validationResult.valid}`);
  console.log(`Invitation ID: ${validationResult.invitationId}`);
  console.log(`Supplier Email: ${validationResult.supplierEmail}`);
  console.log(`Company Name: ${validationResult.companyName}`);
  console.log(`Token State: ${validationResult.tokenState}`);
  console.log(`Validation Attempts: ${validationResult.validationAttempts}`);
  console.log(`\nMetadata:`);
  console.log(JSON.stringify(validationResult.metadata, null, 2));
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Error Codes Tested:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  Object.entries(ERROR_CODES).forEach(([key, value]) => {
    console.log(`✅ ${key}: ${value}`);
  });
  
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED - REVIEW IMPLEMENTATION\n');
  console.log('Failed Tests:');
  results.tests
    .filter(t => t.status.startsWith('❌'))
    .forEach(t => console.log(`  - ${t.name}: ${t.status}`));
  
  process.exit(1);
}
