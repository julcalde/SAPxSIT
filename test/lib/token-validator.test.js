/**
 * Unit Tests for Token Validator
 * 
 * Test Coverage:
 * - Valid token validation with database checks
 * - Signature verification (valid/invalid)
 * - Expiry validation (valid/expired)
 * - Token state checks (consumed, revoked, expired)
 * - Rate limiting enforcement
 * - Database error handling
 * - Helper functions (signature-only, isExpired, getId)
 * - Error formatting
 * 
 * Framework: Jest with mocked database
 * 
 * @module test/lib/token-validator.test
 */

const jwt = require('jsonwebtoken');
const {
  validateToken,
  validateTokenSignatureOnly,
  isTokenExpired,
  getInvitationIdFromToken,
  formatValidationError,
  ValidationError,
  ERROR_CODES
} = require('../../srv/lib/token-validator');

const { generateInvitationToken, generateKeyPair } = require('../../srv/lib/token-manager');
const { hashToken } = require('../../srv/lib/crypto-utils');

describe('Token Validator - validateToken', () => {
  
  let keyPair;
  let testToken;
  let testResult;
  let mockDb;
  
  beforeAll(() => {
    // Generate key pair once for all tests
    keyPair = generateKeyPair();
    
    // Generate test token
    testResult = generateInvitationToken({
      email: 'test-supplier@example.com',
      companyName: 'Test Company GmbH',
      contactName: 'Jane Doe',
      requesterId: 'purchaser@company.com',
      departmentCode: 'PURCHASING',
      expiryDays: 7,
      privateKey: keyPair.privateKey
    });
    
    testToken = testResult.token;
  });
  
  beforeEach(() => {
    // Create fresh mock database for each test
    mockDb = {
      entities: jest.fn(() => ({
        SupplierInvitations: 'supplierOnboarding.SupplierInvitations'
      })),
      read: jest.fn(() => ({
        where: jest.fn(() => ({
          one: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn()
        }))
      }))
    };
  });
  
  describe('Successful validation', () => {
    
    test('should validate token with all database checks', async () => {
      // Mock database to return valid invitation
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        companyName: 'Test Company GmbH',
        contactName: 'Jane Doe',
        tokenHash: testResult.tokenHash,
        tokenState: 'SENT',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 0,
        createdBy: 'purchaser@company.com',
        departmentCode: 'PURCHASING'
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      const result = await validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb,
        ipAddress: '192.168.1.1'
      });
      
      expect(result.valid).toBe(true);
      expect(result.invitationId).toBe(testResult.invitationId);
      expect(result.supplierEmail).toBe('test-supplier@example.com');
      expect(result.companyName).toBe('Test Company GmbH');
      expect(result.tokenState).toBe('VALIDATED');
      expect(result.claims).toHaveProperty('invitation_id');
      expect(result.metadata).toHaveProperty('issuedAt');
    });
    
    test('should update tokenState to VALIDATED on first validation', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'SENT',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 0
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      const updateMock = jest.fn();
      mockDb.update().set().where.mockImplementation(updateMock);
      
      await validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      });
      
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenState: 'VALIDATED',
          validationAttempts: 1
        })
      );
    });
    
    test('should increment validationAttempts counter', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'VALIDATED',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 2
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      const result = await validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      });
      
      expect(mockDb.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          validationAttempts: 3
        })
      );
    });
    
    test('should track IP address if provided', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'VALIDATED',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 0
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb,
        ipAddress: '203.0.113.42'
      });
      
      expect(mockDb.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastValidatedIP: '203.0.113.42'
        })
      );
    });
    
  });
  
  describe('Parameter validation', () => {
    
    test('should throw error if token is missing', async () => {
      await expect(validateToken()).rejects.toThrow(ValidationError);
      await expect(validateToken()).rejects.toMatchObject({
        code: ERROR_CODES.MISSING_TOKEN
      });
    });
    
    test('should throw error if token is empty string', async () => {
      await expect(validateToken('')).rejects.toThrow(ValidationError);
      await expect(validateToken('')).rejects.toMatchObject({
        code: ERROR_CODES.MISSING_TOKEN
      });
    });
    
    test('should throw error if token is not a string', async () => {
      await expect(validateToken(12345)).rejects.toThrow(ValidationError);
      await expect(validateToken(12345)).rejects.toMatchObject({
        code: ERROR_CODES.INVALID_FORMAT
      });
    });
    
    test('should throw error if token format is invalid', async () => {
      await expect(validateToken('invalid.token')).rejects.toThrow(ValidationError);
      await expect(validateToken('invalid.token')).rejects.toMatchObject({
        code: ERROR_CODES.INVALID_FORMAT
      });
    });
    
  });
  
  describe('Signature verification', () => {
    
    test('should fail with invalid signature', async () => {
      const wrongKeyPair = generateKeyPair();
      
      await expect(validateToken(testToken, {
        publicKey: wrongKeyPair.publicKey
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: wrongKeyPair.publicKey
      })).rejects.toMatchObject({
        code: ERROR_CODES.SIGNATURE_INVALID
      });
    });
    
    test('should fail with tampered token', async () => {
      const parts = testToken.split('.');
      const tamperedToken = parts[0] + '.' + parts[1] + '.tampered';
      
      await expect(validateToken(tamperedToken, {
        publicKey: keyPair.publicKey
      })).rejects.toThrow(ValidationError);
    });
    
    test('should warn if no public key provided', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await validateToken(testToken, {});
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No public key provided')
      );
      expect(result.valid).toBe(true);
      expect(result.warning).toBe('Database checks skipped');
      
      consoleWarnSpy.mockRestore();
    });
    
  });
  
  describe('Expiry validation', () => {
    
    test('should fail if token is expired', async () => {
      // Create expired token
      const expiredPayload = {
        ...jwt.decode(testToken),
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      const expiredToken = jwt.sign(expiredPayload, keyPair.privateKey, {
        algorithm: 'RS256'
      });
      
      await expect(validateToken(expiredToken, {
        publicKey: keyPair.publicKey
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(expiredToken, {
        publicKey: keyPair.publicKey
      })).rejects.toMatchObject({
        code: ERROR_CODES.TOKEN_EXPIRED
      });
    });
    
    test('should fail if database shows token expired', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'SENT',
        issuedAt: testResult.issuedAt,
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        validationAttempts: 0
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.TOKEN_EXPIRED
      });
    });
    
  });
  
  describe('Token state validation', () => {
    
    test('should fail if token is consumed', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'CONSUMED',
        consumedAt: new Date(),
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 1
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.ALREADY_CONSUMED
      });
    });
    
    test('should fail if token is revoked', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'REVOKED',
        revokedAt: new Date(),
        revokedBy: 'admin@company.com',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 0
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.REVOKED
      });
    });
    
    test('should fail if token state is EXPIRED', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'EXPIRED',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 0
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.TOKEN_EXPIRED
      });
    });
    
  });
  
  describe('Database validation', () => {
    
    test('should fail if invitation not found in database', async () => {
      mockDb.read().where().one.mockResolvedValue(null);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.NOT_FOUND
      });
    });
    
    test('should handle database errors gracefully', async () => {
      mockDb.read().where().one.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.DATABASE_ERROR
      });
    });
    
    test('should skip database checks if no db provided', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = await validateToken(testToken, {
        publicKey: keyPair.publicKey
      });
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No database service provided')
      );
      expect(result.valid).toBe(true);
      expect(result.warning).toBe('Database checks skipped');
      
      consoleWarnSpy.mockRestore();
    });
    
  });
  
  describe('Rate limiting', () => {
    
    test('should fail if validation attempts exceed limit', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'VALIDATED',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 5 // At limit
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb
      })).rejects.toMatchObject({
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED
      });
    });
    
    test('should respect custom maxValidationAttempts config', async () => {
      const mockInvitation = {
        ID: testResult.invitationId,
        email: 'test-supplier@example.com',
        tokenState: 'VALIDATED',
        issuedAt: testResult.issuedAt,
        expiresAt: testResult.expiresAt,
        validationAttempts: 3
      };
      
      mockDb.read().where().one.mockResolvedValue(mockInvitation);
      
      await expect(validateToken(testToken, {
        publicKey: keyPair.publicKey,
        db: mockDb,
        config: { maxValidationAttempts: 3 }
      })).rejects.toThrow(ValidationError);
    });
    
  });
  
  describe('Required claims validation', () => {
    
    test('should fail if invitation_id claim missing', async () => {
      const payload = { ...jwt.decode(testToken) };
      delete payload.invitation_id;
      
      const invalidToken = jwt.sign(payload, keyPair.privateKey, {
        algorithm: 'RS256'
      });
      
      await expect(validateToken(invalidToken, {
        publicKey: keyPair.publicKey
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(invalidToken, {
        publicKey: keyPair.publicKey
      })).rejects.toMatchObject({
        code: ERROR_CODES.INVALID_CLAIMS
      });
    });
    
    test('should fail if supplier_email claim missing', async () => {
      const payload = { ...jwt.decode(testToken) };
      delete payload.supplier_email;
      
      const invalidToken = jwt.sign(payload, keyPair.privateKey, {
        algorithm: 'RS256'
      });
      
      await expect(validateToken(invalidToken, {
        publicKey: keyPair.publicKey
      })).rejects.toThrow(ValidationError);
      
      await expect(validateToken(invalidToken, {
        publicKey: keyPair.publicKey
      })).rejects.toMatchObject({
        code: ERROR_CODES.INVALID_CLAIMS
      });
    });
    
  });
  
});

describe('Token Validator - Helper Functions', () => {
  
  let keyPair;
  let testToken;
  
  beforeAll(() => {
    keyPair = generateKeyPair();
    const result = generateInvitationToken({
      email: 'test@example.com',
      privateKey: keyPair.privateKey
    });
    testToken = result.token;
  });
  
  describe('validateTokenSignatureOnly', () => {
    
    test('should validate token signature without database', () => {
      const decoded = validateTokenSignatureOnly(testToken, keyPair.publicKey);
      
      expect(decoded).toHaveProperty('invitation_id');
      expect(decoded).toHaveProperty('supplier_email');
    });
    
    test('should throw error if public key missing', () => {
      expect(() => {
        validateTokenSignatureOnly(testToken);
      }).toThrow(ValidationError);
    });
    
    test('should fail with wrong public key', () => {
      const wrongKeyPair = generateKeyPair();
      
      expect(() => {
        validateTokenSignatureOnly(testToken, wrongKeyPair.publicKey);
      }).toThrow(ValidationError);
    });
    
  });
  
  describe('isTokenExpired', () => {
    
    test('should return false for valid token', () => {
      expect(isTokenExpired(testToken)).toBe(false);
    });
    
    test('should return true for expired token', () => {
      const expiredPayload = {
        ...jwt.decode(testToken),
        exp: Math.floor(Date.now() / 1000) - 3600
      };
      
      const expiredToken = jwt.sign(expiredPayload, keyPair.privateKey, {
        algorithm: 'RS256'
      });
      
      expect(isTokenExpired(expiredToken)).toBe(true);
    });
    
    test('should return true for invalid token', () => {
      expect(isTokenExpired('invalid.token')).toBe(true);
    });
    
  });
  
  describe('getInvitationIdFromToken', () => {
    
    test('should extract invitation ID', () => {
      const decoded = jwt.decode(testToken);
      const id = getInvitationIdFromToken(testToken);
      
      expect(id).toBe(decoded.invitation_id);
    });
    
    test('should return null for invalid token', () => {
      expect(getInvitationIdFromToken('invalid')).toBeNull();
    });
    
    test('should return null if claim missing', () => {
      const payload = { email: 'test@example.com' };
      const tokenWithoutId = jwt.sign(payload, keyPair.privateKey, {
        algorithm: 'RS256'
      });
      
      expect(getInvitationIdFromToken(tokenWithoutId)).toBeNull();
    });
    
  });
  
  describe('formatValidationError', () => {
    
    test('should format ValidationError correctly', () => {
      const error = new ValidationError(
        ERROR_CODES.TOKEN_EXPIRED,
        'Token has expired',
        { expiredAt: '2024-01-01' }
      );
      
      const formatted = formatValidationError(error);
      
      expect(formatted.valid).toBe(false);
      expect(formatted.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
      expect(formatted.error.message).toBe('Token has expired');
      expect(formatted.error.details.expiredAt).toBe('2024-01-01');
      expect(formatted.error).toHaveProperty('timestamp');
    });
    
    test('should format generic Error', () => {
      const error = new Error('Something went wrong');
      const formatted = formatValidationError(error);
      
      expect(formatted.valid).toBe(false);
      expect(formatted.error.code).toBe(ERROR_CODES.UNKNOWN_ERROR);
      expect(formatted.error.message).toBe('Something went wrong');
    });
    
  });
  
});

describe('Token Validator - Integration Tests', () => {
  
  test('should validate complete workflow', async () => {
    const keyPair = generateKeyPair();
    
    // Step 1: Generate token
    const tokenResult = generateInvitationToken({
      email: 'supplier@example.com',
      companyName: 'Acme Corp',
      privateKey: keyPair.privateKey
    });
    
    // Step 2: Mock database
    const mockDb = {
      entities: jest.fn(() => ({
        SupplierInvitations: 'supplierOnboarding.SupplierInvitations'
      })),
      read: jest.fn(() => ({
        where: jest.fn(() => ({
          one: jest.fn().mockResolvedValue({
            ID: tokenResult.invitationId,
            email: 'supplier@example.com',
            companyName: 'Acme Corp',
            tokenHash: tokenResult.tokenHash,
            tokenState: 'SENT',
            issuedAt: tokenResult.issuedAt,
            expiresAt: tokenResult.expiresAt,
            validationAttempts: 0
          })
        }))
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn()
        }))
      }))
    };
    
    // Step 3: Validate token
    const result = await validateToken(tokenResult.token, {
      publicKey: keyPair.publicKey,
      db: mockDb,
      ipAddress: '192.168.1.1'
    });
    
    // Step 4: Verify result
    expect(result.valid).toBe(true);
    expect(result.invitationId).toBe(tokenResult.invitationId);
    expect(result.supplierEmail).toBe('supplier@example.com');
    expect(result.tokenState).toBe('VALIDATED');
    expect(mockDb.update).toHaveBeenCalled();
  });
  
});
