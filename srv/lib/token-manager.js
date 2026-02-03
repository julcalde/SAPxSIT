/**
 * Token Manager Module
 * 
 * Purpose: Generate and manage JWT magic link tokens for supplier invitations
 * 
 * Features:
 * - RS256 algorithm (RSA signature with SHA-256)
 * - 7-day default expiry (configurable)
 * - Custom claims for invitation context
 * - Single-use enforcement via jti
 * - XSUAA-compatible token structure
 * 
 * Security:
 * - Asymmetric encryption (private key for signing, public key for verification)
 * - SHA-256 hash stored in database (not the full JWT)
 * - Expiry enforced at token and database level
 * - Rate limiting support via validation attempts tracking
 * 
 * @module srv/lib/token-manager
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { hashToken, generateUUID } = require('./crypto-utils');

/**
 * Default token configuration
 */
const DEFAULT_CONFIG = {
  algorithm: 'RS256',           // RSA with SHA-256
  expiresIn: '7d',              // 7 days
  issuer: 'supplier-onboarding-cap',
  subject: 'invitation-service',
  audience: 'supplier-onboarding-app',
  scope: ['supplier.onboard']
};

/**
 * Generate private/public key pair for RS256 (for development/testing)
 * 
 * In production, use XSUAA-provided keys from service binding
 * 
 * @returns {Object} Object with privateKey and publicKey
 */
function generateKeyPair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  return { privateKey, publicKey };
}

/**
 * Generate invitation token with JWT
 * 
 * Flow:
 * 1. Validate input parameters
 * 2. Generate unique invitation ID (UUID v4)
 * 3. Calculate expiry timestamp
 * 4. Create JWT payload with standard + custom claims
 * 5. Sign token with RS256 private key
 * 6. Generate SHA-256 hash for database storage
 * 7. Return token + invitation record data
 * 
 * @param {Object} params - Token generation parameters
 * @param {string} params.email - Supplier email address (required)
 * @param {string} params.companyName - Supplier company name (optional)
 * @param {string} params.contactName - Supplier contact person (optional)
 * @param {string} params.requesterId - Internal user creating invitation (optional)
 * @param {string} params.requesterName - Name of internal user (optional)
 * @param {string} params.departmentCode - Department for ABAC (optional)
 * @param {string} params.costCenter - Cost center for ABAC (optional)
 * @param {number} params.expiryDays - Expiry in days (default: 7)
 * @param {string} params.privateKey - RS256 private key (required for production)
 * @param {Object} params.config - Token configuration overrides (optional)
 * 
 * @returns {Object} Token generation result
 * @returns {string} result.token - Signed JWT token
 * @returns {string} result.invitationId - UUID for database record
 * @returns {string} result.tokenHash - SHA-256 hash for database lookup
 * @returns {number} result.issuedAt - Unix timestamp (seconds)
 * @returns {number} result.expiresAt - Unix timestamp (seconds)
 * @returns {string} result.jwtPayload - JSON string of full payload
 * @returns {Object} result.invitationData - Data for database insertion
 * 
 * @throws {Error} If required parameters are missing or invalid
 * 
 * @example
 * const result = generateInvitationToken({
 *   email: 'contact@supplier.com',
 *   companyName: 'Acme Supplier GmbH',
 *   contactName: 'Jane Doe',
 *   requesterId: 'purchaser@company.com',
 *   requesterName: 'John Smith',
 *   departmentCode: 'PURCHASING',
 *   costCenter: 'CC-1234',
 *   expiryDays: 7,
 *   privateKey: process.env.JWT_PRIVATE_KEY
 * });
 * 
 * console.log(result.token);          // "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
 * console.log(result.invitationId);   // "7f3c4e2a-9b1d-4c8e-a5f3-2d9e1c4b8a7f"
 * console.log(result.tokenHash);      // "a3f5c9e1b2d4f6a8c0e2b4d6f8a0c2e4..."
 */
function generateInvitationToken(params) {
  // =========================================================================
  // 1. VALIDATE INPUT PARAMETERS
  // =========================================================================
  
  if (!params || typeof params !== 'object') {
    throw new Error('Parameters object is required');
  }
  
  const { email, companyName, contactName, requesterId, requesterName,
          departmentCode, costCenter, expiryDays, privateKey, config } = params;
  
  // Email is mandatory
  if (!email || typeof email !== 'string') {
    throw new Error('Supplier email is required');
  }
  
  // Email format validation (basic)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
  
  // Private key required (in production, from XSUAA binding)
  let signingKey = privateKey;
  if (!signingKey) {
    // For development/testing: generate ephemeral key pair
    console.warn('WARNING: No private key provided. Generating ephemeral key for development only.');
    const { privateKey: devKey } = generateKeyPair();
    signingKey = devKey;
  }
  
  // =========================================================================
  // 2. GENERATE UNIQUE IDENTIFIERS
  // =========================================================================
  
  const invitationId = generateUUID();
  const jti = generateUUID(); // JWT ID (for single-use tracking)
  
  // =========================================================================
  // 3. CALCULATE TIMESTAMPS
  // =========================================================================
  
  const now = Math.floor(Date.now() / 1000); // Unix timestamp (seconds)
  const expiry = expiryDays || 7;
  const expiresAt = now + (expiry * 24 * 60 * 60); // Add days in seconds
  
  // =========================================================================
  // 4. BUILD JWT PAYLOAD
  // =========================================================================
  
  const tokenConfig = { ...DEFAULT_CONFIG, ...config };
  
  const payload = {
    // Standard JWT claims
    iss: tokenConfig.issuer,
    sub: tokenConfig.subject,
    aud: tokenConfig.audience,
    exp: expiresAt,
    iat: now,
    jti: jti,
    
    // OAuth2 scope
    scope: tokenConfig.scope,
    
    // Custom claims for invitation context
    invitation_id: invitationId,
    supplier_email: email,
    company_name: companyName || null,
    contact_name: contactName || null,
    requester_id: requesterId || 'system',
    requester_name: requesterName || 'System',
    department_code: departmentCode || null,
    cost_center: costCenter || null,
    created_at: new Date(now * 1000).toISOString(),
    purpose: 'supplier_onboarding',
    allowed_uses: 1,  // Single-use token
    initial_state: 'CREATED'
  };
  
  // =========================================================================
  // 5. SIGN TOKEN WITH RS256
  // =========================================================================
  
  const token = jwt.sign(payload, signingKey, {
    algorithm: tokenConfig.algorithm,
    header: {
      alg: tokenConfig.algorithm,
      typ: 'JWT',
      kid: 'supplier-onboarding-key-1' // Key ID (should match XSUAA key)
    }
  });
  
  // =========================================================================
  // 6. GENERATE TOKEN HASH FOR DATABASE STORAGE
  // =========================================================================
  
  const tokenHash = hashToken(token);
  
  // =========================================================================
  // 7. PREPARE INVITATION DATA FOR DATABASE
  // =========================================================================
  
  const invitationData = {
    ID: invitationId,
    email: email,
    companyName: companyName || null,
    contactName: contactName || null,
    tokenHash: tokenHash,
    jwtPayload: JSON.stringify(payload),
    tokenState: 'CREATED',
    issuedAt: new Date(now * 1000).toISOString(),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    validationAttempts: 0,
    departmentCode: departmentCode || null,
    costCenter: costCenter || null,
    invitedBy: requesterId || null
  };
  
  // =========================================================================
  // 8. RETURN RESULT
  // =========================================================================
  
  return {
    token,
    invitationId,
    tokenHash,
    issuedAt: now,
    expiresAt: expiresAt,
    jwtPayload: JSON.stringify(payload),
    invitationData,
    // For debugging (remove in production)
    _debug: {
      expiresIn: `${expiry} days`,
      expiresAtDate: new Date(expiresAt * 1000).toISOString(),
      tokenLength: token.length,
      algorithm: tokenConfig.algorithm
    }
  };
}

/**
 * Decode JWT token without verification (for inspection)
 * 
 * Use case: Quick inspection of token claims without validating signature
 * WARNING: Does NOT verify signature - use only for debugging
 * 
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 * 
 * @example
 * const claims = decodeToken(token);
 * console.log(claims.invitation_id);
 * console.log(claims.supplier_email);
 */
function decodeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token must be a non-empty string');
  }
  
  try {
    return jwt.decode(token, { complete: false });
  } catch (error) {
    throw new Error(`Failed to decode token: ${error.message}`);
  }
}

/**
 * Get token expiry as JavaScript Date object
 * 
 * @param {string} token - JWT token
 * @returns {Date} Expiry date
 * 
 * @example
 * const expiryDate = getTokenExpiry(token);
 * console.log(`Token expires on: ${expiryDate.toISOString()}`);
 */
function getTokenExpiry(token) {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    throw new Error('Token does not contain expiry claim');
  }
  
  return new Date(decoded.exp * 1000);
}

/**
 * Check if token is expired (without signature verification)
 * 
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 * 
 * @example
 * if (isTokenExpired(token)) {
 *   console.log('Token has expired');
 * }
 */
function isTokenExpired(token) {
  try {
    const expiryDate = getTokenExpiry(token);
    return expiryDate < new Date();
  } catch (error) {
    return true; // Treat errors as expired
  }
}

/**
 * Extract invitation ID from token (without verification)
 * 
 * @param {string} token - JWT token
 * @returns {string} Invitation ID (UUID)
 * 
 * @example
 * const invitationId = getInvitationIdFromToken(token);
 * // Use for database lookup
 */
function getInvitationIdFromToken(token) {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.invitation_id) {
    throw new Error('Token does not contain invitation_id claim');
  }
  
  return decoded.invitation_id;
}

/**
 * Generate invitation link URL
 * 
 * @param {string} token - JWT token
 * @param {string} baseUrl - Base URL of Build Apps (optional)
 * @returns {string} Full invitation link
 * 
 * @example
 * const link = generateInvitationLink(
 *   token,
 *   'https://supplier-onboarding.cfapps.eu10.hana.ondemand.com'
 * );
 * // Returns: "https://supplier-onboarding.cfapps.eu10.hana.ondemand.com/?token=eyJhbGc..."
 */
function generateInvitationLink(token, baseUrl) {
  if (!token) {
    throw new Error('Token is required');
  }
  
  const url = baseUrl || process.env.BUILD_APPS_URL || 'http://localhost:5000';
  
  // Encode token for URL safety
  const encodedToken = encodeURIComponent(token);
  
  return `${url}/?token=${encodedToken}`;
}

module.exports = {
  generateInvitationToken,
  generateKeyPair,
  decodeToken,
  getTokenExpiry,
  isTokenExpired,
  getInvitationIdFromToken,
  generateInvitationLink,
  DEFAULT_CONFIG
};
