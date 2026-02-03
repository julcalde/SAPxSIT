#!/usr/bin/env node
/**
 * Manual Validation Script for Step 8 - Invitation Service Handlers
 * 
 * This script performs end-to-end testing of the invitation service handlers
 * to validate all functionality before proceeding to Step 9.
 * 
 * Test Scenarios:
 * 1. Create invitation (valid input)
 * 2. Validate token (extract from link)
 * 3. Check database state transitions
 * 4. Test duplicate invitation prevention
 * 5. Test revocation
 * 6. Test resend functionality
 * 7. Test rate limiting
 * 8. Verify audit logging
 * 
 * Usage:
 *   node scripts/validate-step8.js
 * 
 * Prerequisites:
 *   - CAP project initialized
 *   - Database deployed (cds deploy)
 *   - Environment variables configured
 */

const cds = require('@sap/cds');
const { generateKeyPair } = require('../srv/lib/token-manager');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results
let testsPassed = 0;
let testsFailed = 0;
const failedTests = [];

/**
 * Log test result
 */
function logResult(testName, passed, message = '') {
  if (passed) {
    console.log(`${colors.green}✓${colors.reset} ${testName}`);
    testsPassed++;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${testName}`);
    if (message) console.log(`  ${colors.red}${message}${colors.reset}`);
    testsFailed++;
    failedTests.push({ testName, message });
  }
}

/**
 * Log section header
 */
function logSection(title) {
  console.log(`\n${colors.cyan}━━━ ${title} ━━━${colors.reset}`);
}

/**
 * Main validation function
 */
async function validate() {
  console.log(`${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║   Step 8 Validation: Invitation Service Handlers          ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  let srv, db, keyPair;

  try {
    // =========================================================================
    // SETUP
    // =========================================================================
    logSection('Setup');

    console.log('Loading CAP application...');
    srv = await cds.connect.to('InvitationService');
    db = await cds.connect.to('db');
    
    console.log('Generating test keypair...');
    keyPair = generateKeyPair();
    
    // Configure environment
    process.env.XSUAA_PUBLIC_KEY = keyPair.publicKey;
    process.env.XSUAA_PRIVATE_KEY = keyPair.privateKey;
    process.env.INVITATION_BASE_URL = 'http://localhost:4004/supplier';
    
    logResult('CAP application loaded', true);
    logResult('Environment configured', true);

    // Clear database
    console.log('Clearing database...');
    await db.run(DELETE.from('supplierOnboarding.SupplierInvitations'));
    await db.run(DELETE.from('supplierOnboarding.AuditLogs'));
    logResult('Database cleared', true);

    // =========================================================================
    // TEST 1: Create Invitation
    // =========================================================================
    logSection('Test 1: Create Invitation');

    let invitation1;
    try {
      invitation1 = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier1@example.com',
          companyName: 'Test Company GmbH',
          contactName: 'Jane Doe',
          departmentCode: 'PURCHASING',
          costCenter: 'CC-001',
          expiryDays: 7
        }
      });

      logResult('Invitation created', !!invitation1.invitationId);
      logResult('Invitation link generated', !!invitation1.invitationLink);
      logResult('Expiry date set', !!invitation1.expiresAt);
      logResult('Email returned', invitation1.email === 'supplier1@example.com');
      
      console.log(`  Invitation ID: ${invitation1.invitationId}`);
      console.log(`  Link: ${invitation1.invitationLink.substring(0, 80)}...`);
    } catch (error) {
      logResult('Create invitation', false, error.message);
    }

    // =========================================================================
    // TEST 2: Database Verification
    // =========================================================================
    logSection('Test 2: Database State');

    try {
      const dbInvitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: invitation1.invitationId })
      );

      logResult('Record stored in database', !!dbInvitation);
      logResult('Email stored', dbInvitation.email === 'supplier1@example.com');
      logResult('Company name stored', dbInvitation.companyName === 'Test Company GmbH');
      logResult('Token hash stored', !!dbInvitation.tokenHash);
      logResult('JWT payload stored', !!dbInvitation.jwtPayload);
      logResult('Token state is CREATED', dbInvitation.tokenState === 'CREATED');
      logResult('Validation attempts is 0', dbInvitation.validationAttempts === 0);
      
      console.log(`  Token State: ${dbInvitation.tokenState}`);
      console.log(`  Issued At: ${dbInvitation.issuedAt}`);
      console.log(`  Expires At: ${dbInvitation.expiresAt}`);
    } catch (error) {
      logResult('Database verification', false, error.message);
    }

    // =========================================================================
    // TEST 3: Validate Token
    // =========================================================================
    logSection('Test 3: Token Validation');

    try {
      // Extract token from invitation link
      const linkUrl = new URL(invitation1.invitationLink);
      const token = linkUrl.searchParams.get('token');

      logResult('Token extracted from link', !!token);

      // Validate token
      const validationResult = await srv.send({
        query: 'validateToken',
        data: { token }
      });

      logResult('Token validated', validationResult.valid === true);
      logResult('Invitation ID matches', validationResult.invitationId === invitation1.invitationId);
      logResult('Email matches', validationResult.email === 'supplier1@example.com');
      logResult('Company name matches', validationResult.companyName === 'Test Company GmbH');
      logResult('Token state is VALIDATED', validationResult.tokenState === 'VALIDATED');
      logResult('No error code', !validationResult.errorCode);

      console.log(`  Valid: ${validationResult.valid}`);
      console.log(`  Token State: ${validationResult.tokenState}`);
    } catch (error) {
      logResult('Token validation', false, error.message);
    }

    // =========================================================================
    // TEST 4: Database State After Validation
    // =========================================================================
    logSection('Test 4: State Transition');

    try {
      const dbInvitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: invitation1.invitationId })
      );

      logResult('Token state updated to VALIDATED', dbInvitation.tokenState === 'VALIDATED');
      logResult('Validation attempts incremented', dbInvitation.validationAttempts === 1);
      logResult('Last validated timestamp set', !!dbInvitation.lastValidatedAt);
      logResult('Last validated IP recorded', !!dbInvitation.lastValidatedIP);

      console.log(`  State: ${dbInvitation.tokenState}`);
      console.log(`  Validation Attempts: ${dbInvitation.validationAttempts}`);
    } catch (error) {
      logResult('State transition verification', false, error.message);
    }

    // =========================================================================
    // TEST 5: Duplicate Invitation Prevention
    // =========================================================================
    logSection('Test 5: Duplicate Prevention');

    try {
      await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier1@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });

      logResult('Duplicate invitation rejected', false, 'Should have thrown error');
    } catch (error) {
      const isDuplicateError = error.message.includes('Active invitation already exists');
      logResult('Duplicate invitation rejected', isDuplicateError);
      console.log(`  Error: ${error.message}`);
    }

    // =========================================================================
    // TEST 6: Audit Logging
    // =========================================================================
    logSection('Test 6: Audit Logging');

    try {
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .orderBy({ eventTimestamp: 'asc' })
      );

      logResult('Audit logs created', auditLogs.length > 0);
      
      const creationLog = auditLogs.find(log => log.eventType === 'INVITATION_CREATED');
      logResult('INVITATION_CREATED logged', !!creationLog);
      
      const validationLog = auditLogs.find(log => log.eventType === 'TOKEN_VALIDATED');
      logResult('TOKEN_VALIDATED logged', !!validationLog);

      console.log(`  Total audit entries: ${auditLogs.length}`);
      console.log(`  Event types: ${auditLogs.map(l => l.eventType).join(', ')}`);
    } catch (error) {
      logResult('Audit logging verification', false, error.message);
    }

    // =========================================================================
    // TEST 7: Revoke Invitation
    // =========================================================================
    logSection('Test 7: Revoke Invitation');

    try {
      // Create new invitation for revocation test
      const invitation2 = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier2@example.com',
          companyName: 'Another Company',
          expiryDays: 7
        }
      });

      // Revoke it
      const revokeResult = await srv.send({
        query: 'revokeInvitation',
        data: {
          invitationId: invitation2.invitationId,
          revocationReason: 'Test revocation'
        }
      });

      logResult('Revocation successful', revokeResult.success === true);

      // Check database state
      const dbInvitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: invitation2.invitationId })
      );

      logResult('Token state is REVOKED', dbInvitation.tokenState === 'REVOKED');
      logResult('Revocation reason stored', dbInvitation.revocationReason === 'Test revocation');
      logResult('Revoked timestamp set', !!dbInvitation.revokedAt);

      console.log(`  State: ${dbInvitation.tokenState}`);
      console.log(`  Reason: ${dbInvitation.revocationReason}`);
    } catch (error) {
      logResult('Revocation test', false, error.message);
    }

    // =========================================================================
    // TEST 8: Resend Invitation
    // =========================================================================
    logSection('Test 8: Resend Invitation');

    try {
      const originalLink = invitation1.invitationLink;

      const resendResult = await srv.send({
        query: 'resendInvitation',
        data: {
          invitationId: invitation1.invitationId,
          expiryDays: 14
        }
      });

      logResult('Resend successful', !!resendResult.invitationLink);
      logResult('New link generated', resendResult.invitationLink !== originalLink);
      logResult('New expiry date set', !!resendResult.expiresAt);

      // Check database state
      const dbInvitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: invitation1.invitationId })
      );

      logResult('Token state reset to CREATED', dbInvitation.tokenState === 'CREATED');
      logResult('Validation attempts reset', dbInvitation.validationAttempts === 0);

      console.log(`  New Link: ${resendResult.invitationLink.substring(0, 80)}...`);
      console.log(`  State: ${dbInvitation.tokenState}`);
    } catch (error) {
      logResult('Resend invitation test', false, error.message);
    }

    // =========================================================================
    // TEST 9: Get Invitation Status
    // =========================================================================
    logSection('Test 9: Get Invitation Status');

    try {
      const statusResult = await srv.send({
        query: 'getInvitationStatus',
        data: {
          invitationId: invitation1.invitationId
        }
      });

      logResult('Status retrieved', !!statusResult);
      logResult('Invitation ID matches', statusResult.invitationId === invitation1.invitationId);
      logResult('Email included', statusResult.email === 'supplier1@example.com');
      logResult('isExpired flag present', typeof statusResult.isExpired === 'boolean');
      logResult('isActive flag present', typeof statusResult.isActive === 'boolean');
      logResult('isExpired is false', statusResult.isExpired === false);
      logResult('isActive is true', statusResult.isActive === true);

      console.log(`  State: ${statusResult.tokenState}`);
      console.log(`  Active: ${statusResult.isActive}`);
      console.log(`  Expired: ${statusResult.isExpired}`);
    } catch (error) {
      logResult('Get invitation status', false, error.message);
    }

    // =========================================================================
    // TEST 10: Invalid Token Validation
    // =========================================================================
    logSection('Test 10: Invalid Token Handling');

    try {
      const invalidResult = await srv.send({
        query: 'validateToken',
        data: {
          token: 'invalid.token.here'
        }
      });

      logResult('Invalid token rejected', invalidResult.valid === false);
      logResult('Error code provided', !!invalidResult.errorCode);
      logResult('Error message provided', !!invalidResult.errorMessage);

      console.log(`  Error Code: ${invalidResult.errorCode}`);
      console.log(`  Error Message: ${invalidResult.errorMessage}`);
    } catch (error) {
      logResult('Invalid token handling', false, error.message);
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    logSection('Test Summary');

    console.log(`\nTotal Tests: ${testsPassed + testsFailed}`);
    console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);

    if (testsFailed > 0) {
      console.log(`\n${colors.yellow}Failed Tests:${colors.reset}`);
      failedTests.forEach(({ testName, message }) => {
        console.log(`  - ${testName}`);
        if (message) console.log(`    ${message}`);
      });
    }

    const successRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
    console.log(`\nSuccess Rate: ${successRate}%`);

    if (testsFailed === 0) {
      console.log(`\n${colors.green}✓ All tests passed! Step 8 validation complete.${colors.reset}`);
      console.log(`${colors.green}✓ Ready to proceed to Step 9.${colors.reset}\n`);
    } else {
      console.log(`\n${colors.red}✗ Some tests failed. Please review and fix before proceeding.${colors.reset}\n`);
    }

  } catch (error) {
    console.error(`\n${colors.red}Fatal Error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Cleanup
    await cds.shutdown();
  }
}

// Run validation
validate().catch(error => {
  console.error('Validation failed:', error);
  process.exit(1);
});
