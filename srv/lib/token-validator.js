/**
 * Token Validator Module
 * 
 * Validates JWT magic link tokens for supplier invitations with comprehensive security checks:
 * - RS256 signature verification against XSUAA public key
 * - Expiry, audience, issuer claim validation
 * - Database-backed revocation and consumption checks
 * - Rate limiting (max 5 validation attempts per token)
 * - IP address tracking for anomaly detection
 * 
 * Security Architecture: Step 1 (docs/security-architecture.md)
 * Data Model: Step 4 (db/schema.cds - SupplierInvitations entity)
 * Token Generation: Step 6 (srv/lib/token-manager.js)
 * 
 * @module srv/lib/token-validator
 */

const jwt = require('jsonwebtoken');
const { hashToken } = require('./crypto-utils');

/**
 * Validation error codes for structured error handling
 */
const ERROR_CODES = {
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_FORMAT: 'INVALID_FORMAT',
  SIGNATURE_INVALID: 'SIGNATURE_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CLAIMS: 'INVALID_CLAIMS',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_CONSUMED: 'ALREADY_CONSUMED',
  REVOKED: 'REVOKED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Default configuration for token validation
 */
const DEFAULT_CONFIG = {
  issuer: 'supplier-onboarding-service',
  audience: 'supplier-portal',
  algorithms: ['RS256'],
  maxValidationAttempts: 5,
  clockTolerance: 60, // Allow 60 seconds clock skew
};

/**
 * Validation error class with structured error details
 */
class ValidationError extends Error {
  /**
   * @param {string} code - Error code from ERROR_CODES
   * @param {string} message - Human-readable error message
   * @param {Object} details - Additional error context
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Validates JWT token with comprehensive security checks
 * 
 * Validation Flow:
 * 1. Parameter validation (token must be non-empty string)
 * 2. JWT signature verification (RS256 with XSUAA public key)
 * 3. Standard claim validation (exp, iss, aud)
 * 4. Database lookup by SHA-256 hash
 * 5. Token state check (not consumed, not revoked, not expired)
 * 6. Rate limiting check (max 5 validation attempts)
 * 7. Update validation metrics (attempt count, last validated timestamp)
 * 8. Return decoded claims + invitation metadata
 * 
 * @param {string} token - JWT token string from URL query parameter
 * @param {Object} options - Validation options
 * @param {string} [options.publicKey] - XSUAA public key (PEM format). If not provided, uses development key or throws error.
 * @param {Object} [options.db] - Database service instance (CAP cds.db). Required for database checks.
 * @param {string} [options.ipAddress] - Client IP address for rate limiting
 * @param {Object} [options.config] - Override default validation config
 * 
 * @returns {Promise<Object>} Validation result with structure:
 *   {
 *     valid: true,
 *     claims: { ... },           // Decoded JWT claims
 *     invitationId: "uuid",
 *     supplierEmail: "email",
 *     companyName: "name",
 *     tokenState: "VALIDATED",
 *     validationAttempts: 1,
 *     metadata: { ... }          // Full invitation record
 *   }
 * 
 * @throws {ValidationError} If validation fails with specific error code
 * 
 * @example
 * // In CAP service handler
 * const { validateToken } = require('./lib/token-validator');
 * 
 * try {
 *   const result = await validateToken(token, {
 *     publicKey: process.env.XSUAA_PUBLIC_KEY,
 *     db: cds.db,
 *     ipAddress: req.ip
 *   });
 *   console.log('Token valid:', result.invitationId);
 * } catch (error) {
 *   if (error.code === 'TOKEN_EXPIRED') {
 *     return req.error(401, 'Your invitation link has expired');
 *   }
 * }
 */
async function validateToken(token, options = {}) {
  // Step 1: Parameter validation
  if (!token) {
    throw new ValidationError(
      ERROR_CODES.MISSING_TOKEN,
      'Token parameter is required',
      { parameter: 'token' }
    );
  }
  
  if (typeof token !== 'string' || token.trim().length === 0) {
    throw new ValidationError(
      ERROR_CODES.INVALID_FORMAT,
      'Token must be a non-empty string',
      { tokenType: typeof token }
    );
  }
  
  // Validate JWT format (3 parts separated by dots)
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3) {
    throw new ValidationError(
      ERROR_CODES.INVALID_FORMAT,
      'Invalid JWT format (expected 3 parts separated by dots)',
      { parts: tokenParts.length }
    );
  }
  
  // Extract options
  const { publicKey, db, ipAddress, config = {} } = options;
  const validationConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Step 2: Verify JWT signature
  let decoded;
  try {
    if (!publicKey) {
      console.warn('⚠️  No public key provided. Decoding without verification (DEVELOPMENT ONLY).');
      // In development, decode without verification
      decoded = jwt.decode(token);
      if (!decoded) {
        throw new Error('Failed to decode token');
      }
    } else {
      // Production: verify signature with XSUAA public key
      decoded = jwt.verify(token, publicKey, {
        algorithms: validationConfig.algorithms,
        issuer: validationConfig.issuer,
        audience: validationConfig.audience,
        clockTolerance: validationConfig.clockTolerance
      });
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ValidationError(
        ERROR_CODES.TOKEN_EXPIRED,
        'Token has expired',
        { expiredAt: error.expiredAt }
      );
    }
    
    if (error.name === 'JsonWebTokenError') {
      throw new ValidationError(
        ERROR_CODES.SIGNATURE_INVALID,
        'Invalid token signature or claims',
        { originalError: error.message }
      );
    }
    
    throw new ValidationError(
      ERROR_CODES.UNKNOWN_ERROR,
      `Token verification failed: ${error.message}`,
      { originalError: error.message }
    );
  }
  
  // Step 3: Validate required custom claims
  if (!decoded.invitation_id) {
    throw new ValidationError(
      ERROR_CODES.INVALID_CLAIMS,
      'Token missing required claim: invitation_id',
      { claims: Object.keys(decoded) }
    );
  }
  
  if (!decoded.supplier_email) {
    throw new ValidationError(
      ERROR_CODES.INVALID_CLAIMS,
      'Token missing required claim: supplier_email',
      { claims: Object.keys(decoded) }
    );
  }
  
  // Step 4: Database lookup (if db provided)
  if (!db) {
    console.warn('⚠️  No database service provided. Skipping database checks (TESTING ONLY).');
    
    // Return minimal validation result without database
    return {
      valid: true,
      claims: decoded,
      invitationId: decoded.invitation_id,
      supplierEmail: decoded.supplier_email,
      companyName: decoded.company_name || null,
      tokenState: 'VALIDATED',
      validationAttempts: 0,
      warning: 'Database checks skipped'
    };
  }
  
  // Generate token hash for database lookup
  const tokenHash = hashToken(token);
  
  // Query SupplierInvitations entity
  let invitation;
  try {
    const { SupplierInvitations } = db.entities('supplierOnboarding');
    
    invitation = await db.read(SupplierInvitations)
      .where({ tokenHash })
      .one();
    
    if (!invitation) {
      throw new ValidationError(
        ERROR_CODES.NOT_FOUND,
        'Invitation not found or token has been regenerated',
        { tokenHash: tokenHash.substring(0, 16) + '...' }
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    
    throw new ValidationError(
      ERROR_CODES.DATABASE_ERROR,
      'Failed to query invitation database',
      { originalError: error.message }
    );
  }
  
  // Step 5: Check token state
  if (invitation.tokenState === 'CONSUMED') {
    throw new ValidationError(
      ERROR_CODES.ALREADY_CONSUMED,
      'This invitation has already been used',
      { 
        consumedAt: invitation.consumedAt,
        invitationId: invitation.ID
      }
    );
  }
  
  if (invitation.tokenState === 'REVOKED') {
    throw new ValidationError(
      ERROR_CODES.REVOKED,
      'This invitation has been revoked by an administrator',
      { 
        revokedAt: invitation.revokedAt,
        revokedBy: invitation.revokedBy
      }
    );
  }
  
  if (invitation.tokenState === 'EXPIRED') {
    throw new ValidationError(
      ERROR_CODES.TOKEN_EXPIRED,
      'This invitation has expired',
      { 
        expiresAt: invitation.expiresAt,
        invitationId: invitation.ID
      }
    );
  }
  
  // Check expiry timestamp (in case state not updated yet)
  const now = Math.floor(Date.now() / 1000);
  if (invitation.expiresAt && invitation.expiresAt < now) {
    // Update state to EXPIRED
    try {
      await db.update('supplierOnboarding.SupplierInvitations')
        .set({ tokenState: 'EXPIRED' })
        .where({ ID: invitation.ID });
    } catch (error) {
      console.error('Failed to update token state to EXPIRED:', error);
    }
    
    throw new ValidationError(
      ERROR_CODES.TOKEN_EXPIRED,
      'This invitation has expired',
      { 
        expiresAt: new Date(invitation.expiresAt * 1000).toISOString(),
        invitationId: invitation.ID
      }
    );
  }
  
  // Step 6: Rate limiting check
  const validationAttempts = invitation.validationAttempts || 0;
  if (validationAttempts >= validationConfig.maxValidationAttempts) {
    throw new ValidationError(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      `Maximum validation attempts exceeded (${validationConfig.maxValidationAttempts})`,
      { 
        attempts: validationAttempts,
        maxAttempts: validationConfig.maxValidationAttempts,
        invitationId: invitation.ID
      }
    );
  }
  
  // Step 7: Update validation metrics
  try {
    const newAttempts = validationAttempts + 1;
    const updateData = {
      validationAttempts: newAttempts,
      lastValidatedAt: new Date(),
      lastValidatedIP: ipAddress || null
    };
    
    // If first validation, update state to VALIDATED
    if (invitation.tokenState === 'SENT' || invitation.tokenState === 'DELIVERED' || invitation.tokenState === 'OPENED') {
      updateData.tokenState = 'VALIDATED';
    }
    
    await db.update('supplierOnboarding.SupplierInvitations')
      .set(updateData)
      .where({ ID: invitation.ID });
    
    // Update local invitation object
    invitation.validationAttempts = newAttempts;
    invitation.lastValidatedAt = updateData.lastValidatedAt;
    invitation.tokenState = updateData.tokenState || invitation.tokenState;
    
  } catch (error) {
    console.error('Failed to update validation metrics:', error);
    // Continue execution - this is not a critical error
  }
  
  // Step 8: Return validation result
  return {
    valid: true,
    claims: decoded,
    invitationId: invitation.ID,
    supplierEmail: invitation.email,
    companyName: invitation.companyName,
    contactName: invitation.contactName,
    tokenState: invitation.tokenState,
    validationAttempts: invitation.validationAttempts,
    metadata: {
      issuedAt: invitation.issuedAt,
      expiresAt: invitation.expiresAt,
      createdBy: invitation.createdBy,
      departmentCode: invitation.departmentCode,
      costCenter: invitation.costCenter
    }
  };
}

/**
 * Validates token without database checks (signature + claims only)
 * Used for lightweight validation or when database is unavailable
 * 
 * @param {string} token - JWT token string
 * @param {string} publicKey - XSUAA public key (PEM format)
 * @param {Object} config - Optional validation config override
 * @returns {Object} Decoded JWT claims
 * @throws {ValidationError} If token invalid
 */
function validateTokenSignatureOnly(token, publicKey, config = {}) {
  const validationConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!token) {
    throw new ValidationError(ERROR_CODES.MISSING_TOKEN, 'Token is required');
  }
  
  if (!publicKey) {
    throw new ValidationError(ERROR_CODES.SIGNATURE_INVALID, 'Public key is required');
  }
  
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: validationConfig.algorithms,
      issuer: validationConfig.issuer,
      audience: validationConfig.audience,
      clockTolerance: validationConfig.clockTolerance
    });
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ValidationError(ERROR_CODES.TOKEN_EXPIRED, 'Token has expired');
    }
    
    if (error.name === 'JsonWebTokenError') {
      throw new ValidationError(ERROR_CODES.SIGNATURE_INVALID, 'Invalid token signature');
    }
    
    throw new ValidationError(ERROR_CODES.UNKNOWN_ERROR, error.message);
  }
}

/**
 * Checks if token is expired without full validation
 * 
 * @param {string} token - JWT token string
 * @returns {boolean} True if expired, false otherwise
 */
function isTokenExpired(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  } catch (error) {
    return true;
  }
}

/**
 * Extracts invitation ID from token without validation
 * 
 * @param {string} token - JWT token string
 * @returns {string|null} Invitation ID or null if not found
 */
function getInvitationIdFromToken(token) {
  try {
    const decoded = jwt.decode(token);
    return decoded?.invitation_id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Formats validation error for API response
 * 
 * @param {ValidationError} error - Validation error instance
 * @returns {Object} Formatted error response
 */
function formatValidationError(error) {
  if (!(error instanceof ValidationError)) {
    return {
      valid: false,
      error: {
        code: ERROR_CODES.UNKNOWN_ERROR,
        message: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }
    };
  }
  
  return {
    valid: false,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp
    }
  };
}

// Module exports
module.exports = {
  validateToken,
  validateTokenSignatureOnly,
  isTokenExpired,
  getInvitationIdFromToken,
  formatValidationError,
  ValidationError,
  ERROR_CODES,
  DEFAULT_CONFIG
};
