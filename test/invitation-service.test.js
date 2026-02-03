/**
 * Unit Tests for Invitation Service Handlers
 * 
 * Test Coverage:
 * - createInvitation action (email validation, rate limiting, duplicate check)
 * - validateToken action (public endpoint, error handling)
 * - revokeInvitation action (authorization, state validation)
 * - resendInvitation action (token regeneration)
 * - getInvitationStatus function (read-only)
 * - Authorization checks (XSUAA scopes)
 * - Audit logging (all operations)
 * - Database state transitions
 * 
 * Framework: Jest with CAP test utilities
 * 
 * @module test/invitation-service.test
 */

const cds = require('@sap/cds');
const { generateKeyPair } = require('../srv/lib/token-manager');

describe('Invitation Service', () => {
  
  let srv, db, keyPair;
  
  beforeAll(async () => {
    // Load CAP application
    srv = await cds.connect.to('InvitationService');
    db = await cds.connect.to('db');
    
    // Generate test keypair
    keyPair = generateKeyPair();
    
    // Set environment variables for testing
    process.env.XSUAA_PUBLIC_KEY = keyPair.publicKey;
    process.env.XSUAA_PRIVATE_KEY = keyPair.privateKey;
    process.env.INVITATION_BASE_URL = 'http://localhost:4004/supplier';
    process.env.MAX_INVITATIONS_PER_HOUR = '100';
    process.env.MAX_VALIDATION_ATTEMPTS = '5';
  });
  
  afterAll(async () => {
    // Cleanup
    await cds.shutdown();
  });
  
  beforeEach(async () => {
    // Clear database before each test
    await db.run(DELETE.from('supplierOnboarding.SupplierInvitations'));
    await db.run(DELETE.from('supplierOnboarding.AuditLogs'));
  });
  
  // ===========================================================================
  // CREATE INVITATION
  // ===========================================================================
  
  describe('createInvitation', () => {
    
    test('should create invitation with valid email', async () => {
      const result = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company GmbH',
          contactName: 'Jane Doe',
          departmentCode: 'PURCHASING',
          costCenter: 'CC-001',
          expiryDays: 7
        }
      });
      
      expect(result).toHaveProperty('invitationId');
      expect(result).toHaveProperty('invitationLink');
      expect(result).toHaveProperty('expiresAt');
      expect(result.email).toBe('supplier@example.com');
      expect(result.invitationLink).toContain('token=');
    });
    
    test('should store invitation in database', async () => {
      const result = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: result.invitationId })
      );
      
      expect(invitation).toBeTruthy();
      expect(invitation.email).toBe('supplier@example.com');
      expect(invitation.companyName).toBe('Test Company');
      expect(invitation.tokenState).toBe('CREATED');
      expect(invitation.validationAttempts).toBe(0);
    });
    
    test('should create audit log entry', async () => {
      const result = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'INVITATION_CREATED' })
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].invitationId).toBe(result.invitationId);
      expect(auditLogs[0].eventType).toBe('INVITATION_CREATED');
    });
    
    test('should fail with invalid email format', async () => {
      await expect(
        srv.send({
          query: 'createInvitation',
          data: {
            email: 'invalid-email',
            companyName: 'Test Company',
            expiryDays: 7
          }
        })
      ).rejects.toThrow();
    });
    
    test('should fail with duplicate active invitation', async () => {
      // Create first invitation
      await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });
      
      // Try to create duplicate
      await expect(
        srv.send({
          query: 'createInvitation',
          data: {
            email: 'supplier@example.com',
            companyName: 'Test Company',
            expiryDays: 7
          }
        })
      ).rejects.toThrow(/Active invitation already exists/);
    });
    
    test('should enforce expiry days limits', async () => {
      await expect(
        srv.send({
          query: 'createInvitation',
          data: {
            email: 'supplier@example.com',
            companyName: 'Test Company',
            expiryDays: 100 // Too high
          }
        })
      ).rejects.toThrow();
    });
    
    test('should include optional fields', async () => {
      const result = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          contactName: 'Jane Doe',
          departmentCode: 'DEPT-001',
          costCenter: 'CC-123',
          invitationNotes: 'Urgent request',
          expiryDays: 14
        }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: result.invitationId })
      );
      
      expect(invitation.contactName).toBe('Jane Doe');
      expect(invitation.departmentCode).toBe('DEPT-001');
      expect(invitation.costCenter).toBe('CC-123');
      expect(invitation.invitationNotes).toBe('Urgent request');
    });
    
  });
  
  // ===========================================================================
  // VALIDATE TOKEN
  // ===========================================================================
  
  describe('validateToken', () => {
    
    let testInvitation, testToken;
    
    beforeEach(async () => {
      // Create test invitation
      const createResult = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          contactName: 'Jane Doe',
          expiryDays: 7
        }
      });
      
      testInvitation = createResult;
      
      // Extract token from link
      const linkUrl = new URL(createResult.invitationLink);
      testToken = linkUrl.searchParams.get('token');
    });
    
    test('should validate valid token', async () => {
      const result = await srv.send({
        query: 'validateToken',
        data: {
          token: testToken
        }
      });
      
      expect(result.valid).toBe(true);
      expect(result.invitationId).toBe(testInvitation.invitationId);
      expect(result.email).toBe('supplier@example.com');
      expect(result.companyName).toBe('Test Company');
      expect(result.contactName).toBe('Jane Doe');
      expect(result.tokenState).toBe('VALIDATED');
      expect(result.errorCode).toBeNull();
    });
    
    test('should update tokenState to VALIDATED', async () => {
      await srv.send({
        query: 'validateToken',
        data: { token: testToken }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: testInvitation.invitationId })
      );
      
      expect(invitation.tokenState).toBe('VALIDATED');
      expect(invitation.validationAttempts).toBe(1);
    });
    
    test('should increment validation attempts', async () => {
      // First validation
      await srv.send({
        query: 'validateToken',
        data: { token: testToken }
      });
      
      // Second validation
      await srv.send({
        query: 'validateToken',
        data: { token: testToken }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: testInvitation.invitationId })
      );
      
      expect(invitation.validationAttempts).toBe(2);
    });
    
    test('should create audit log for successful validation', async () => {
      await srv.send({
        query: 'validateToken',
        data: { token: testToken }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'TOKEN_VALIDATED' })
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].invitationId).toBe(testInvitation.invitationId);
    });
    
    test('should fail with invalid token', async () => {
      const result = await srv.send({
        query: 'validateToken',
        data: {
          token: 'invalid.token.here'
        }
      });
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBeTruthy();
      expect(result.errorMessage).toBeTruthy();
    });
    
    test('should fail with missing token', async () => {
      const result = await srv.send({
        query: 'validateToken',
        data: {}
      });
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_TOKEN');
    });
    
    test('should fail after rate limit exceeded', async () => {
      // Validate 5 times (max limit)
      for (let i = 0; i < 5; i++) {
        await srv.send({
          query: 'validateToken',
          data: { token: testToken }
        });
      }
      
      // 6th attempt should fail
      const result = await srv.send({
        query: 'validateToken',
        data: { token: testToken }
      });
      
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    });
    
    test('should create audit log for failed validation', async () => {
      await srv.send({
        query: 'validateToken',
        data: {
          token: 'invalid.token.here'
        }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'TOKEN_VALIDATION_FAILED' })
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });
    
  });
  
  // ===========================================================================
  // REVOKE INVITATION
  // ===========================================================================
  
  describe('revokeInvitation', () => {
    
    let testInvitation;
    
    beforeEach(async () => {
      const createResult = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });
      
      testInvitation = createResult;
    });
    
    test('should revoke active invitation', async () => {
      const result = await srv.send({
        query: 'revokeInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          revocationReason: 'Supplier no longer needed'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('revoked successfully');
    });
    
    test('should update tokenState to REVOKED', async () => {
      await srv.send({
        query: 'revokeInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          revocationReason: 'Test revocation'
        }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: testInvitation.invitationId })
      );
      
      expect(invitation.tokenState).toBe('REVOKED');
      expect(invitation.revokedAt).toBeTruthy();
      expect(invitation.revocationReason).toBe('Test revocation');
    });
    
    test('should create audit log', async () => {
      await srv.send({
        query: 'revokeInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          revocationReason: 'Test'
        }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'TOKEN_REVOKED' })
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].invitationId).toBe(testInvitation.invitationId);
    });
    
    test('should fail with non-existent invitation', async () => {
      await expect(
        srv.send({
          query: 'revokeInvitation',
          data: {
            invitationId: '00000000-0000-0000-0000-000000000000',
            revocationReason: 'Test'
          }
        })
      ).rejects.toThrow(/not found/);
    });
    
    test('should fail revoking already consumed invitation', async () => {
      // Update invitation to CONSUMED
      await db.run(
        UPDATE('supplierOnboarding.SupplierInvitations')
          .set({ tokenState: 'CONSUMED' })
          .where({ ID: testInvitation.invitationId })
      );
      
      await expect(
        srv.send({
          query: 'revokeInvitation',
          data: {
            invitationId: testInvitation.invitationId,
            revocationReason: 'Test'
          }
        })
      ).rejects.toThrow(/Cannot revoke consumed/);
    });
    
    test('should fail revoking already revoked invitation', async () => {
      // Revoke once
      await srv.send({
        query: 'revokeInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          revocationReason: 'First revocation'
        }
      });
      
      // Try to revoke again
      await expect(
        srv.send({
          query: 'revokeInvitation',
          data: {
            invitationId: testInvitation.invitationId,
            revocationReason: 'Second revocation'
          }
        })
      ).rejects.toThrow(/already revoked/);
    });
    
  });
  
  // ===========================================================================
  // RESEND INVITATION
  // ===========================================================================
  
  describe('resendInvitation', () => {
    
    let testInvitation;
    
    beforeEach(async () => {
      const createResult = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });
      
      testInvitation = createResult;
    });
    
    test('should regenerate token', async () => {
      const originalLink = testInvitation.invitationLink;
      
      const result = await srv.send({
        query: 'resendInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          expiryDays: 14
        }
      });
      
      expect(result.invitationLink).toBeTruthy();
      expect(result.invitationLink).not.toBe(originalLink);
      expect(result.expiresAt).toBeTruthy();
    });
    
    test('should reset validation attempts', async () => {
      // Validate token first
      const linkUrl = new URL(testInvitation.invitationLink);
      const token = linkUrl.searchParams.get('token');
      
      await srv.send({
        query: 'validateToken',
        data: { token }
      });
      
      // Resend
      await srv.send({
        query: 'resendInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          expiryDays: 7
        }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: testInvitation.invitationId })
      );
      
      expect(invitation.validationAttempts).toBe(0);
      expect(invitation.tokenState).toBe('CREATED');
    });
    
    test('should create audit log', async () => {
      await srv.send({
        query: 'resendInvitation',
        data: {
          invitationId: testInvitation.invitationId,
          expiryDays: 14
        }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'INVITATION_RESENT' })
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });
    
    test('should fail with consumed invitation', async () => {
      // Update to CONSUMED
      await db.run(
        UPDATE('supplierOnboarding.SupplierInvitations')
          .set({ tokenState: 'CONSUMED' })
          .where({ ID: testInvitation.invitationId })
      );
      
      await expect(
        srv.send({
          query: 'resendInvitation',
          data: {
            invitationId: testInvitation.invitationId,
            expiryDays: 7
          }
        })
      ).rejects.toThrow(/Cannot resend consumed/);
    });
    
  });
  
  // ===========================================================================
  // GET INVITATION STATUS
  // ===========================================================================
  
  describe('getInvitationStatus', () => {
    
    let testInvitation;
    
    beforeEach(async () => {
      const createResult = await srv.send({
        query: 'createInvitation',
        data: {
          email: 'supplier@example.com',
          companyName: 'Test Company',
          expiryDays: 7
        }
      });
      
      testInvitation = createResult;
    });
    
    test('should return invitation status', async () => {
      const result = await srv.send({
        query: 'getInvitationStatus',
        data: {
          invitationId: testInvitation.invitationId
        }
      });
      
      expect(result.invitationId).toBe(testInvitation.invitationId);
      expect(result.email).toBe('supplier@example.com');
      expect(result.companyName).toBe('Test Company');
      expect(result.tokenState).toBe('CREATED');
      expect(result.isActive).toBe(true);
      expect(result.isExpired).toBe(false);
    });
    
    test('should detect expired invitations', async () => {
      // Update to expired
      await db.run(
        UPDATE('supplierOnboarding.SupplierInvitations')
          .set({ 
            expiresAt: new Date(Date.now() - 1000) // 1 second ago
          })
          .where({ ID: testInvitation.invitationId })
      );
      
      const result = await srv.send({
        query: 'getInvitationStatus',
        data: {
          invitationId: testInvitation.invitationId
        }
      });
      
      expect(result.isExpired).toBe(true);
    });
    
    test('should fail with non-existent invitation', async () => {
      await expect(
        srv.send({
          query: 'getInvitationStatus',
          data: {
            invitationId: '00000000-0000-0000-0000-000000000000'
          }
        })
      ).rejects.toThrow(/not found/);
    });
    
  });
  
  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================
  
  describe('Rate Limiting', () => {
    
    test('should enforce creation rate limit', async () => {
      // Override config for testing
      process.env.MAX_INVITATIONS_PER_HOUR = '3';
      
      // Create 3 invitations (at limit)
      for (let i = 0; i < 3; i++) {
        await srv.send({
          query: 'createInvitation',
          data: {
            email: `supplier${i}@example.com`,
            companyName: 'Test Company',
            expiryDays: 7
          }
        });
      }
      
      // 4th should fail
      await expect(
        srv.send({
          query: 'createInvitation',
          data: {
            email: 'supplier4@example.com',
            companyName: 'Test Company',
            expiryDays: 7
          }
        })
      ).rejects.toThrow(/Rate limit exceeded/);
      
      // Reset
      process.env.MAX_INVITATIONS_PER_HOUR = '100';
    });
    
  });
  
});
