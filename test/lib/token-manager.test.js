/**
 * Unit Tests for Token Manager
 * 
 * Test Coverage:
 * - Token generation with valid inputs
 * - Token structure and claims validation
 * - Expiry calculation
 * - Error handling (missing parameters, invalid inputs)
 * - Helper functions (decode, getExpiry, generateLink)
 * - Edge cases (empty strings, special characters, long values)
 * 
 * Framework: Jest
 * 
 * @module test/lib/token-manager.test
 */

const jwt = require('jsonwebtoken');
const {
  generateInvitationToken,
  generateKeyPair,
  decodeToken,
  getTokenExpiry,
  isTokenExpired,
  getInvitationIdFromToken,
  generateInvitationLink,
  DEFAULT_CONFIG
} = require('../../srv/lib/token-manager');

const { hashToken } = require('../../srv/lib/crypto-utils');

describe('Token Manager - generateInvitationToken', () => {
  
  let keyPair;
  
  beforeAll(() => {
    // Generate key pair once for all tests
    keyPair = generateKeyPair();
  });
  
  describe('Successful token generation', () => {
    
    test('should generate token with minimum required parameters', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('invitationId');
      expect(result).toHaveProperty('tokenHash');
      expect(result).toHaveProperty('issuedAt');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('jwtPayload');
      expect(result).toHaveProperty('invitationData');
      
      expect(result.token).toMatch(/^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
      expect(result.invitationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(result.tokenHash).toHaveLength(64);
    });
    
    test('should generate token with all optional parameters', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        companyName: 'Acme Supplier GmbH',
        contactName: 'Jane Doe',
        requesterId: 'purchaser@company.com',
        requesterName: 'John Smith',
        departmentCode: 'PURCHASING',
        costCenter: 'CC-1234',
        expiryDays: 14,
        privateKey: keyPair.privateKey
      });
      
      const decoded = decodeToken(result.token);
      
      expect(decoded.supplier_email).toBe('supplier@example.com');
      expect(decoded.company_name).toBe('Acme Supplier GmbH');
      expect(decoded.contact_name).toBe('Jane Doe');
      expect(decoded.requester_id).toBe('purchaser@company.com');
      expect(decoded.requester_name).toBe('John Smith');
      expect(decoded.department_code).toBe('PURCHASING');
      expect(decoded.cost_center).toBe('CC-1234');
    });
    
    test('should include all standard JWT claims', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      const decoded = decodeToken(result.token);
      
      expect(decoded).toHaveProperty('iss');
      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('aud');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('jti');
      expect(decoded).toHaveProperty('scope');
      
      expect(decoded.iss).toBe(DEFAULT_CONFIG.issuer);
      expect(decoded.sub).toBe(DEFAULT_CONFIG.subject);
      expect(decoded.aud).toBe(DEFAULT_CONFIG.audience);
      expect(decoded.scope).toEqual(DEFAULT_CONFIG.scope);
    });
    
    test('should include all custom claims', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        companyName: 'Test Company',
        privateKey: keyPair.privateKey
      });
      
      const decoded = decodeToken(result.token);
      
      expect(decoded).toHaveProperty('invitation_id');
      expect(decoded).toHaveProperty('supplier_email');
      expect(decoded).toHaveProperty('company_name');
      expect(decoded).toHaveProperty('created_at');
      expect(decoded).toHaveProperty('purpose');
      expect(decoded).toHaveProperty('allowed_uses');
      expect(decoded).toHaveProperty('initial_state');
      
      expect(decoded.purpose).toBe('supplier_onboarding');
      expect(decoded.allowed_uses).toBe(1);
      expect(decoded.initial_state).toBe('CREATED');
    });
    
    test('should use RS256 algorithm', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      const decodedHeader = jwt.decode(result.token, { complete: true }).header;
      
      expect(decodedHeader.alg).toBe('RS256');
      expect(decodedHeader.typ).toBe('JWT');
      expect(decodedHeader.kid).toBe('supplier-onboarding-key-1');
    });
    
  });
  
  describe('Expiry calculation', () => {
    
    test('should default to 7 days expiry', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      const expiryDiff = result.expiresAt - result.issuedAt;
      const expectedDiff = 7 * 24 * 60 * 60; // 7 days in seconds
      
      expect(expiryDiff).toBe(expectedDiff);
    });
    
    test('should respect custom expiry days', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        expiryDays: 14,
        privateKey: keyPair.privateKey
      });
      
      const expiryDiff = result.expiresAt - result.issuedAt;
      const expectedDiff = 14 * 24 * 60 * 60; // 14 days in seconds
      
      expect(expiryDiff).toBe(expectedDiff);
    });
    
    test('should have expiry in the future', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      const now = Math.floor(Date.now() / 1000);
      
      expect(result.expiresAt).toBeGreaterThan(now);
      expect(result.issuedAt).toBeLessThanOrEqual(now);
    });
    
  });
  
  describe('Token hash generation', () => {
    
    test('should generate consistent hash for same token', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      const hash1 = hashToken(result.token);
      const hash2 = hashToken(result.token);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(result.tokenHash);
    });
    
    test('should generate different hash for different tokens', () => {
      const result1 = generateInvitationToken({
        email: 'supplier1@example.com',
        privateKey: keyPair.privateKey
      });
      
      const result2 = generateInvitationToken({
        email: 'supplier2@example.com',
        privateKey: keyPair.privateKey
      });
      
      expect(result1.tokenHash).not.toBe(result2.tokenHash);
    });
    
    test('should generate 64-character hexadecimal hash', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      expect(result.tokenHash).toHaveLength(64);
      expect(result.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });
    
  });
  
  describe('Invitation data structure', () => {
    
    test('should generate invitation data for database insertion', () => {
      const result = generateInvitationToken({
        email: 'supplier@example.com',
        companyName: 'Test Company',
        departmentCode: 'DEPT-001',
        privateKey: keyPair.privateKey
      });
      
      const data = result.invitationData;
      
      expect(data).toHaveProperty('ID');
      expect(data).toHaveProperty('email');
      expect(data).toHaveProperty('companyName');
      expect(data).toHaveProperty('tokenHash');
      expect(data).toHaveProperty('jwtPayload');
      expect(data).toHaveProperty('tokenState');
      expect(data).toHaveProperty('issuedAt');
      expect(data).toHaveProperty('expiresAt');
      expect(data).toHaveProperty('validationAttempts');
      
      expect(data.email).toBe('supplier@example.com');
      expect(data.companyName).toBe('Test Company');
      expect(data.tokenState).toBe('CREATED');
      expect(data.validationAttempts).toBe(0);
    });
    
  });
  
  describe('Error handling', () => {
    
    test('should throw error if no parameters provided', () => {
      expect(() => {
        generateInvitationToken();
      }).toThrow('Parameters object is required');
    });
    
    test('should throw error if email is missing', () => {
      expect(() => {
        generateInvitationToken({
          privateKey: keyPair.privateKey
        });
      }).toThrow('Supplier email is required');
    });
    
    test('should throw error if email is invalid format', () => {
      expect(() => {
        generateInvitationToken({
          email: 'invalid-email',
          privateKey: keyPair.privateKey
        });
      }).toThrow('Invalid email format');
    });
    
    test('should throw error if email is empty string', () => {
      expect(() => {
        generateInvitationToken({
          email: '',
          privateKey: keyPair.privateKey
        });
      }).toThrow('Supplier email is required');
    });
    
    test('should generate ephemeral key if privateKey not provided', () => {
      // Should not throw, but should warn
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const result = generateInvitationToken({
        email: 'supplier@example.com'
      });
      
      expect(result).toHaveProperty('token');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No private key provided')
      );
      
      consoleWarnSpy.mockRestore();
    });
    
  });
  
});

describe('Token Manager - Helper Functions', () => {
  
  let keyPair;
  let testToken;
  let testResult;
  
  beforeAll(() => {
    keyPair = generateKeyPair();
    testResult = generateInvitationToken({
      email: 'supplier@example.com',
      companyName: 'Test Company',
      privateKey: keyPair.privateKey
    });
    testToken = testResult.token;
  });
  
  describe('decodeToken', () => {
    
    test('should decode valid token', () => {
      const decoded = decodeToken(testToken);
      
      expect(decoded).toHaveProperty('invitation_id');
      expect(decoded).toHaveProperty('supplier_email');
      expect(decoded.supplier_email).toBe('supplier@example.com');
    });
    
    test('should throw error for invalid token', () => {
      expect(() => {
        decodeToken('invalid.token.here');
      }).toThrow('Failed to decode token');
    });
    
    test('should throw error for empty token', () => {
      expect(() => {
        decodeToken('');
      }).toThrow('Token must be a non-empty string');
    });
    
  });
  
  describe('getTokenExpiry', () => {
    
    test('should return Date object', () => {
      const expiry = getTokenExpiry(testToken);
      
      expect(expiry).toBeInstanceOf(Date);
    });
    
    test('should return expiry in the future', () => {
      const expiry = getTokenExpiry(testToken);
      
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
    
    test('should match expiresAt from generation', () => {
      const expiry = getTokenExpiry(testToken);
      const expectedExpiry = new Date(testResult.expiresAt * 1000);
      
      expect(expiry.getTime()).toBe(expectedExpiry.getTime());
    });
    
  });
  
  describe('isTokenExpired', () => {
    
    test('should return false for valid token', () => {
      expect(isTokenExpired(testToken)).toBe(false);
    });
    
    test('should return true for expired token', () => {
      // Generate token with -1 day expiry (already expired)
      const expiredResult = generateInvitationToken({
        email: 'supplier@example.com',
        privateKey: keyPair.privateKey
      });
      
      // Manually create expired token by modifying payload
      const decoded = decodeToken(expiredResult.token);
      decoded.exp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      
      const expiredToken = jwt.sign(decoded, keyPair.privateKey, {
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
      const invitationId = getInvitationIdFromToken(testToken);
      
      expect(invitationId).toBe(testResult.invitationId);
      expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
    });
    
    test('should throw error for token without invitation_id', () => {
      const tokenWithoutId = jwt.sign(
        { email: 'test@example.com' },
        keyPair.privateKey,
        { algorithm: 'RS256' }
      );
      
      expect(() => {
        getInvitationIdFromToken(tokenWithoutId);
      }).toThrow('Token does not contain invitation_id claim');
    });
    
  });
  
  describe('generateInvitationLink', () => {
    
    test('should generate link with default URL', () => {
      const link = generateInvitationLink(testToken);
      
      expect(link).toContain('?token=');
      expect(link).toContain(encodeURIComponent(testToken));
    });
    
    test('should generate link with custom base URL', () => {
      const baseUrl = 'https://supplier-app.example.com';
      const link = generateInvitationLink(testToken, baseUrl);
      
      expect(link).toStartWith(baseUrl);
      expect(link).toContain('?token=');
    });
    
    test('should URL-encode the token', () => {
      const link = generateInvitationLink(testToken);
      const urlParams = new URLSearchParams(link.split('?')[1]);
      const decodedToken = urlParams.get('token');
      
      expect(decodedToken).toBe(testToken);
    });
    
    test('should throw error if token is missing', () => {
      expect(() => {
        generateInvitationLink();
      }).toThrow('Token is required');
    });
    
  });
  
});

describe('Token Manager - Key Pair Generation', () => {
  
  test('should generate valid RSA key pair', () => {
    const { privateKey, publicKey } = generateKeyPair();
    
    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privateKey).toContain('-----END PRIVATE KEY-----');
    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(publicKey).toContain('-----END PUBLIC KEY-----');
  });
  
  test('should generate key pair that can sign and verify', () => {
    const { privateKey, publicKey } = generateKeyPair();
    
    const result = generateInvitationToken({
      email: 'supplier@example.com',
      privateKey
    });
    
    // Verify token with public key
    expect(() => {
      jwt.verify(result.token, publicKey, {
        algorithms: ['RS256']
      });
    }).not.toThrow();
  });
  
  test('should generate unique key pairs', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();
    
    expect(keyPair1.privateKey).not.toBe(keyPair2.privateKey);
    expect(keyPair1.publicKey).not.toBe(keyPair2.publicKey);
  });
  
});

describe('Token Manager - Integration Tests', () => {
  
  test('should generate token that can be verified with public key', () => {
    const { privateKey, publicKey } = generateKeyPair();
    
    const result = generateInvitationToken({
      email: 'supplier@example.com',
      companyName: 'Test Company',
      privateKey
    });
    
    const verified = jwt.verify(result.token, publicKey, {
      algorithms: ['RS256']
    });
    
    expect(verified.supplier_email).toBe('supplier@example.com');
    expect(verified.company_name).toBe('Test Company');
  });
  
  test('should fail verification with wrong public key', () => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();
    
    const result = generateInvitationToken({
      email: 'supplier@example.com',
      privateKey: keyPair1.privateKey
    });
    
    expect(() => {
      jwt.verify(result.token, keyPair2.publicKey, {
        algorithms: ['RS256']
      });
    }).toThrow();
  });
  
  test('should generate complete workflow data', () => {
    const { privateKey } = generateKeyPair();
    
    const result = generateInvitationToken({
      email: 'supplier@example.com',
      companyName: 'Acme Supplier GmbH',
      contactName: 'Jane Doe',
      requesterId: 'purchaser@company.com',
      departmentCode: 'PURCHASING',
      expiryDays: 7,
      privateKey
    });
    
    // Verify we have all data needed for:
    // 1. Database insertion
    expect(result.invitationData.ID).toBeTruthy();
    expect(result.invitationData.tokenHash).toBeTruthy();
    
    // 2. Email sending
    const link = generateInvitationLink(result.token);
    expect(link).toContain(result.token);
    
    // 3. Token validation (later step)
    const decoded = decodeToken(result.token);
    expect(decoded.invitation_id).toBe(result.invitationId);
    
    // 4. Expiry checking
    expect(isTokenExpired(result.token)).toBe(false);
  });
  
});
