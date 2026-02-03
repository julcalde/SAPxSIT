/**
 * Crypto Utilities Module
 * 
 * Purpose: Provide cryptographic functions for token management
 * - SHA-256 hashing for token lookup/verification
 * - UUID v4 generation for invitation IDs
 * - Secure random string generation
 * 
 * Security:
 * - Uses Node.js native crypto module
 * - FIPS-compliant algorithms
 * - No external dependencies
 * 
 * @module srv/lib/crypto-utils
 */

const crypto = require('crypto');

/**
 * Generate SHA-256 hash of a string
 * 
 * Used for:
 * - Token hash storage (lookup in database)
 * - Integrity verification
 * - One-way encryption of sensitive data
 * 
 * @param {string} input - String to hash
 * @returns {string} Hexadecimal hash (64 characters)
 * 
 * @example
 * const tokenHash = hashToken('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...');
 * // Returns: "a3f5c9e1b2d4f6a8c0e2b4d6f8a0c2e4b6d8f0a2c4e6b8d0f2a4c6e8b0d2f4a6"
 */
function hashToken(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Input must be a non-empty string');
  }
  
  return crypto
    .createHash('sha256')
    .update(input, 'utf8')
    .digest('hex');
}

/**
 * Generate UUID v4 (random)
 * 
 * Used for:
 * - Invitation IDs (primary keys)
 * - JWT ID (jti claim)
 * - Correlation IDs for distributed tracing
 * 
 * @returns {string} UUID v4 in canonical format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 * 
 * @example
 * const invitationId = generateUUID();
 * // Returns: "7f3c4e2a-9b1d-4c8e-a5f3-2d9e1c4b8a7f"
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Generate cryptographically secure random string
 * 
 * Used for:
 * - CSRF tokens
 * - Nonces
 * - Session IDs
 * 
 * @param {number} length - Length of random string (default: 32)
 * @returns {string} Hexadecimal random string
 * 
 * @example
 * const csrfToken = generateRandomString(32);
 * // Returns: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
 */
function generateRandomString(length = 32) {
  if (length < 16) {
    throw new Error('Random string length must be at least 16 characters');
  }
  
  const bytes = Math.ceil(length / 2);
  return crypto
    .randomBytes(bytes)
    .toString('hex')
    .substring(0, length);
}

/**
 * Hash password using PBKDF2 (not used in current implementation, future use)
 * 
 * @param {string} password - Plain text password
 * @param {string} salt - Salt (optional, generated if not provided)
 * @returns {Object} Object with hash and salt
 * 
 * @example
 * const { hash, salt } = hashPassword('mySecurePassword123!');
 */
function hashPassword(password, salt = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  
  // Generate salt if not provided
  const passwordSalt = salt || crypto.randomBytes(16).toString('hex');
  
  // PBKDF2 with 100,000 iterations (OWASP recommendation)
  const hash = crypto.pbkdf2Sync(
    password,
    passwordSalt,
    100000,
    64,
    'sha512'
  ).toString('hex');
  
  return {
    hash,
    salt: passwordSalt
  };
}

/**
 * Verify password against hash (not used in current implementation, future use)
 * 
 * @param {string} password - Plain text password to verify
 * @param {string} hash - Stored hash
 * @param {string} salt - Stored salt
 * @returns {boolean} True if password matches
 */
function verifyPassword(password, hash, salt) {
  const { hash: computedHash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(computedHash, 'hex')
  );
}

/**
 * Generate HMAC signature
 * 
 * Used for:
 * - Webhook signature verification
 * - Message authentication
 * 
 * @param {string} message - Message to sign
 * @param {string} secret - Secret key
 * @param {string} algorithm - HMAC algorithm (default: 'sha256')
 * @returns {string} Hexadecimal signature
 * 
 * @example
 * const signature = generateHMAC('{"event":"invitation.created"}', 'secret-key');
 */
function generateHMAC(message, secret, algorithm = 'sha256') {
  if (!message || !secret) {
    throw new Error('Message and secret are required');
  }
  
  return crypto
    .createHmac(algorithm, secret)
    .update(message, 'utf8')
    .digest('hex');
}

/**
 * Verify HMAC signature
 * 
 * @param {string} message - Original message
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key
 * @param {string} algorithm - HMAC algorithm (default: 'sha256')
 * @returns {boolean} True if signature is valid
 * 
 * @example
 * const isValid = verifyHMAC(message, receivedSignature, 'secret-key');
 */
function verifyHMAC(message, signature, secret, algorithm = 'sha256') {
  const expectedSignature = generateHMAC(message, secret, algorithm);
  
  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

module.exports = {
  hashToken,
  generateUUID,
  generateRandomString,
  hashPassword,
  verifyPassword,
  generateHMAC,
  verifyHMAC
};
