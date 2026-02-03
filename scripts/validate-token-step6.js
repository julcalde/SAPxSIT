#!/usr/bin/env node

/**
 * Manual Validation Script for Step 6 - Token Generation Logic
 * 
 * This script validates the token-manager.js implementation by:
 * 1. Generating test keypair
 * 2. Creating invitation token with all parameters
 * 3. Decoding and inspecting JWT payload
 * 4. Verifying signature with public key
 * 5. Testing helper functions
 * 6. Validating against security architecture
 * 
 * Run: node scripts/validate-token-step6.js
 */

const { 
  generateInvitationToken, 
  generateKeyPair, 
  decodeToken,
  getTokenExpiry,
  isTokenExpired,
  getInvitationIdFromToken,
  generateInvitationLink 
} = require('../srv/lib/token-manager');

const { hashToken } = require('../srv/lib/crypto-utils');
const jwt = require('jsonwebtoken');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Step 6: Token Generation Logic - Manual Validation          ║');
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
// 1. Generate Test Keypair
// ============================================================================
console.log('\n📋 Phase 1: Key Pair Generation\n');

let keyPair;
test('Generate RSA key pair', () => {
  keyPair = generateKeyPair();
  assert(keyPair.privateKey.includes('-----BEGIN PRIVATE KEY-----'), 'Invalid private key format');
  assert(keyPair.publicKey.includes('-----BEGIN PUBLIC KEY-----'), 'Invalid public key format');
});

// ============================================================================
// 2. Generate Invitation Token
// ============================================================================
console.log('\n📋 Phase 2: Token Generation\n');

let result;
test('Generate token with all parameters', () => {
  result = generateInvitationToken({
    email: 'test-supplier@example.com',
    companyName: 'Acme Test GmbH',
    contactName: 'Jane Doe',
    requesterId: 'purchaser@company.com',
    requesterName: 'John Smith',
    departmentCode: 'PURCHASING',
    costCenter: 'CC-TEST-001',
    expiryDays: 7,
    privateKey: keyPair.privateKey
  });
  
  assert(result.token, 'Token not generated');
  assert(result.invitationId, 'Invitation ID not generated');
  assert(result.tokenHash, 'Token hash not generated');
  assert(result.issuedAt, 'issuedAt not set');
  assert(result.expiresAt, 'expiresAt not set');
});

test('Token format is valid JWT', () => {
  assert(
    result.token.match(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/),
    'Invalid JWT format'
  );
});

test('Invitation ID is valid UUID v4', () => {
  assert(
    result.invitationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    'Invalid UUID v4 format'
  );
});

test('Token hash is 64-char hexadecimal (SHA-256)', () => {
  assert(result.tokenHash.length === 64, 'Token hash not 64 characters');
  assert(result.tokenHash.match(/^[0-9a-f]{64}$/), 'Token hash not hexadecimal');
});

test('Expiry is 7 days from issuance', () => {
  const expiryDiff = result.expiresAt - result.issuedAt;
  const expectedDiff = 7 * 24 * 60 * 60; // 7 days in seconds
  assert(expiryDiff === expectedDiff, `Expiry diff is ${expiryDiff}, expected ${expectedDiff}`);
});

// ============================================================================
// 3. Decode and Inspect JWT Payload
// ============================================================================
console.log('\n📋 Phase 3: JWT Payload Inspection\n');

let decoded;
test('Decode token successfully', () => {
  decoded = decodeToken(result.token);
  assert(decoded, 'Failed to decode token');
});

// Standard JWT claims
test('Standard claim: iss (issuer)', () => {
  assert(decoded.iss === 'supplier-onboarding-service', `iss is ${decoded.iss}`);
});

test('Standard claim: sub (subject)', () => {
  assert(decoded.sub === 'supplier-invitation', `sub is ${decoded.sub}`);
});

test('Standard claim: aud (audience)', () => {
  assert(decoded.aud === 'supplier-portal', `aud is ${decoded.aud}`);
});

test('Standard claim: exp (expiry)', () => {
  assert(decoded.exp > Math.floor(Date.now() / 1000), 'Token already expired');
});

test('Standard claim: iat (issued at)', () => {
  assert(decoded.iat <= Math.floor(Date.now() / 1000), 'iat is in the future');
});

test('Standard claim: jti (JWT ID)', () => {
  assert(decoded.jti, 'jti not present');
  assert(decoded.jti.match(/^[0-9a-f-]{36}$/i), 'jti not a valid UUID');
});

test('Standard claim: scope', () => {
  assert(Array.isArray(decoded.scope), 'scope is not an array');
  assert(decoded.scope.includes('supplier.onboard'), 'Missing supplier.onboard scope');
});

// Custom claims
test('Custom claim: invitation_id', () => {
  assert(decoded.invitation_id === result.invitationId, 'invitation_id mismatch');
});

test('Custom claim: supplier_email', () => {
  assert(decoded.supplier_email === 'test-supplier@example.com', 'supplier_email mismatch');
});

test('Custom claim: company_name', () => {
  assert(decoded.company_name === 'Acme Test GmbH', 'company_name mismatch');
});

test('Custom claim: contact_name', () => {
  assert(decoded.contact_name === 'Jane Doe', 'contact_name mismatch');
});

test('Custom claim: requester_id', () => {
  assert(decoded.requester_id === 'purchaser@company.com', 'requester_id mismatch');
});

test('Custom claim: requester_name', () => {
  assert(decoded.requester_name === 'John Smith', 'requester_name mismatch');
});

test('Custom claim: department_code', () => {
  assert(decoded.department_code === 'PURCHASING', 'department_code mismatch');
});

test('Custom claim: cost_center', () => {
  assert(decoded.cost_center === 'CC-TEST-001', 'cost_center mismatch');
});

test('Custom claim: created_at', () => {
  assert(decoded.created_at === result.issuedAt, 'created_at mismatch');
});

test('Custom claim: purpose', () => {
  assert(decoded.purpose === 'supplier_onboarding', 'purpose mismatch');
});

test('Custom claim: allowed_uses', () => {
  assert(decoded.allowed_uses === 1, 'allowed_uses should be 1');
});

test('Custom claim: initial_state', () => {
  assert(decoded.initial_state === 'CREATED', 'initial_state should be CREATED');
});

// ============================================================================
// 4. Verify Signature
// ============================================================================
console.log('\n📋 Phase 4: Signature Verification\n');

test('Verify token signature with public key', () => {
  const verified = jwt.verify(result.token, keyPair.publicKey, {
    algorithms: ['RS256']
  });
  assert(verified, 'Signature verification failed');
  assert(verified.supplier_email === 'test-supplier@example.com', 'Verified payload mismatch');
});

test('Token header contains RS256 algorithm', () => {
  const decodedHeader = jwt.decode(result.token, { complete: true }).header;
  assert(decodedHeader.alg === 'RS256', `Algorithm is ${decodedHeader.alg}, expected RS256`);
  assert(decodedHeader.typ === 'JWT', `Type is ${decodedHeader.typ}, expected JWT`);
});

test('Token header contains kid (key ID)', () => {
  const decodedHeader = jwt.decode(result.token, { complete: true }).header;
  assert(decodedHeader.kid === 'supplier-onboarding-key-1', 'kid mismatch');
});

// ============================================================================
// 5. Test Helper Functions
// ============================================================================
console.log('\n📋 Phase 5: Helper Functions\n');

test('getTokenExpiry returns Date object', () => {
  const expiry = getTokenExpiry(result.token);
  assert(expiry instanceof Date, 'Expiry is not a Date object');
  assert(expiry.getTime() > Date.now(), 'Expiry is not in the future');
});

test('isTokenExpired returns false for valid token', () => {
  assert(!isTokenExpired(result.token), 'Valid token marked as expired');
});

test('getInvitationIdFromToken extracts correct ID', () => {
  const id = getInvitationIdFromToken(result.token);
  assert(id === result.invitationId, 'Extracted invitation ID mismatch');
});

test('generateInvitationLink creates valid URL', () => {
  const link = generateInvitationLink(result.token, 'https://supplier.example.com');
  assert(link.startsWith('https://supplier.example.com'), 'URL does not start with base URL');
  assert(link.includes('?token='), 'URL does not contain token parameter');
  assert(link.includes(encodeURIComponent(result.token)), 'Token not properly encoded');
});

// ============================================================================
// 6. Test Token Hash
// ============================================================================
console.log('\n📋 Phase 6: Token Hash Validation\n');

test('Token hash is consistent', () => {
  const hash1 = hashToken(result.token);
  const hash2 = hashToken(result.token);
  assert(hash1 === hash2, 'Hash is not deterministic');
  assert(hash1 === result.tokenHash, 'Hash does not match generated hash');
});

// ============================================================================
// 7. Test Invitation Data Structure
// ============================================================================
console.log('\n📋 Phase 7: Invitation Data Structure\n');

const invData = result.invitationData;

test('invitationData contains ID field', () => {
  assert(invData.ID === result.invitationId, 'ID mismatch');
});

test('invitationData contains email field', () => {
  assert(invData.email === 'test-supplier@example.com', 'Email mismatch');
});

test('invitationData contains companyName field', () => {
  assert(invData.companyName === 'Acme Test GmbH', 'Company name mismatch');
});

test('invitationData contains contactName field', () => {
  assert(invData.contactName === 'Jane Doe', 'Contact name mismatch');
});

test('invitationData contains tokenHash field', () => {
  assert(invData.tokenHash === result.tokenHash, 'Token hash mismatch');
});

test('invitationData contains jwtPayload field', () => {
  assert(typeof invData.jwtPayload === 'string', 'jwtPayload is not a string');
  const parsed = JSON.parse(invData.jwtPayload);
  assert(parsed.invitation_id === result.invitationId, 'jwtPayload invitation_id mismatch');
});

test('invitationData has tokenState = CREATED', () => {
  assert(invData.tokenState === 'CREATED', 'tokenState should be CREATED');
});

test('invitationData has validationAttempts = 0', () => {
  assert(invData.validationAttempts === 0, 'validationAttempts should be 0');
});

// ============================================================================
// 8. Error Handling Tests
// ============================================================================
console.log('\n📋 Phase 8: Error Handling\n');

test('Throws error when email is missing', () => {
  try {
    generateInvitationToken({ privateKey: keyPair.privateKey });
    throw new Error('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('email is required'), 'Wrong error message');
  }
});

test('Throws error when email format is invalid', () => {
  try {
    generateInvitationToken({
      email: 'invalid-email',
      privateKey: keyPair.privateKey
    });
    throw new Error('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('Invalid email format'), 'Wrong error message');
  }
});

test('Throws error when decoding invalid token', () => {
  try {
    decodeToken('invalid.token.here');
    throw new Error('Should have thrown error');
  } catch (error) {
    assert(error.message.includes('Failed to decode'), 'Wrong error message');
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
  console.log('Step 6 token generation implementation is correct and ready for use.\n');
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Sample Token Data:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Invitation ID: ${result.invitationId}`);
  console.log(`Token (first 80 chars): ${result.token.substring(0, 80)}...`);
  console.log(`Token Hash: ${result.tokenHash}`);
  console.log(`Issued At: ${new Date(result.issuedAt * 1000).toISOString()}`);
  console.log(`Expires At: ${new Date(result.expiresAt * 1000).toISOString()}`);
  console.log(`Expiry (days): ${(result.expiresAt - result.issuedAt) / 86400}`);
  console.log(`\nFull JWT Payload:`);
  console.log(JSON.stringify(decoded, null, 2));
  
  process.exit(0);
} else {
  console.log('⚠️  SOME TESTS FAILED - REVIEW IMPLEMENTATION\n');
  console.log('Failed Tests:');
  results.tests
    .filter(t => t.status.startsWith('❌'))
    .forEach(t => console.log(`  - ${t.name}: ${t.status}`));
  
  process.exit(1);
}
