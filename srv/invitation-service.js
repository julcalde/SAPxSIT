/**
 * Invitation Service Implementation
 * 
 * Handles supplier invitation lifecycle:
 * - Create invitations (generate JWT magic links)
 * - Validate tokens (verify and track validation attempts)
 * - Revoke invitations (admin action)
 * - Resend invitations (regenerate token)
 * 
 * Security:
 * - XSUAA role-based authorization (invitation.create, invitation.manage, invitation.audit)
 * - JWT RS256 signature verification
 * - Rate limiting (validation attempts, creation throttling)
 * - Audit logging for all operations
 * 
 * Integration:
 * - Step 6: token-manager.js for token generation
 * - Step 7: token-validator.js for token validation
 * - Step 4: SupplierInvitations entity (database)
 * - Step 3: XSUAA scopes (xs-security.json)
 * 
 * @module srv/invitation-service
 */

const cds = require('@sap/cds');
const { generateInvitationToken } = require('./lib/token-manager');
const { 
  validateToken, 
  formatValidationError, 
  ERROR_CODES 
} = require('./lib/token-validator');

/**
 * Configuration from environment variables
 */
const CONFIG = {
  // Base URL for invitation links (e.g., https://supplier-portal.cfapps.eu10.hana.ondemand.com)
  invitationBaseUrl: process.env.INVITATION_BASE_URL || 'http://localhost:4004/supplier',
  
  // XSUAA public key for JWT verification (PEM format)
  xsuaaPublicKey: process.env.XSUAA_PUBLIC_KEY || null,
  
  // XSUAA private key for JWT signing (PEM format)
  xsuaaPrivateKey: process.env.XSUAA_PRIVATE_KEY || null,
  
  // Rate limiting
  maxInvitationsPerHour: parseInt(process.env.MAX_INVITATIONS_PER_HOUR) || 100,
  maxValidationAttempts: parseInt(process.env.MAX_VALIDATION_ATTEMPTS) || 5,
  
  // Token expiry
  defaultExpiryDays: parseInt(process.env.DEFAULT_EXPIRY_DAYS) || 7,
  maxExpiryDays: parseInt(process.env.MAX_EXPIRY_DAYS) || 30,
};

/**
 * Main service handler registration
 */
module.exports = async (srv) => {
  
  const { SupplierInvitations, AuditLogs } = cds.entities('supplierOnboarding');
  
  // =========================================================================
  // BEFORE HANDLERS - Input validation and authorization
  // =========================================================================
  
  /**
   * Validate email format before creating invitation
   */
  srv.before('createInvitation', (req) => {
    const { email } = req.data;
    
    // RFC 5322 email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      req.error(400, `Invalid email format: ${email}`, 'INVALID_EMAIL');
    }
    
    // Check expiry days within limits
    const expiryDays = req.data.expiryDays || CONFIG.defaultExpiryDays;
    if (expiryDays < 1 || expiryDays > CONFIG.maxExpiryDays) {
      req.error(400, `Expiry days must be between 1 and ${CONFIG.maxExpiryDays}`, 'INVALID_EXPIRY');
    }
  });
  
  /**
   * Rate limiting for invitation creation
   */
  srv.before('createInvitation', async (req) => {
    const userId = req.user?.id || 'anonymous';
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Count invitations created by this user in the last hour
    const recentInvitations = await SELECT.from(SupplierInvitations)
      .where({ 
        createdBy: userId,
        createdAt: { '>': oneHourAgo }
      });
    
    if (recentInvitations.length >= CONFIG.maxInvitationsPerHour) {
      req.error(429, `Rate limit exceeded: Maximum ${CONFIG.maxInvitationsPerHour} invitations per hour`, 'RATE_LIMIT_EXCEEDED');
    }
  });
  
  /**
   * Validate invitation exists before revocation
   */
  srv.before('revokeInvitation', async (req) => {
    const { invitationId } = req.data;
    
    const invitation = await SELECT.one.from(SupplierInvitations).where({ ID: invitationId });
    
    if (!invitation) {
      req.error(404, `Invitation not found: ${invitationId}`, 'INVITATION_NOT_FOUND');
    }
    
    // Cannot revoke already consumed or expired invitations
    if (invitation.tokenState === 'CONSUMED') {
      req.error(400, 'Cannot revoke consumed invitation', 'ALREADY_CONSUMED');
    }
    
    if (invitation.tokenState === 'REVOKED') {
      req.error(400, 'Invitation already revoked', 'ALREADY_REVOKED');
    }
  });
  
  // =========================================================================
  // ACTION HANDLERS
  // =========================================================================
  
  /**
   * createInvitation - Generate new supplier invitation with JWT token
   * 
   * Authorization: invitation.create scope
   * Rate Limit: 100 per hour per user
   */
  srv.on('createInvitation', async (req) => {
    const { 
      email, 
      companyName, 
      contactName, 
      departmentCode, 
      costCenter, 
      invitationNotes,
      expiryDays 
    } = req.data;
    
    try {
      // Get user context
      const userId = req.user?.id || 'system';
      const userName = req.user?.name || 'System';
      
      // Check for existing active invitation
      const existingInvitation = await SELECT.one.from(SupplierInvitations)
        .where({ 
          email: email,
          tokenState: { in: ['CREATED', 'SENT', 'DELIVERED', 'OPENED', 'VALIDATED'] }
        });
      
      if (existingInvitation) {
        return req.error(409, 
          `Active invitation already exists for ${email} (ID: ${existingInvitation.ID})`, 
          'DUPLICATE_INVITATION'
        );
      }
      
      // Generate JWT token
      const tokenResult = generateInvitationToken({
        email,
        companyName,
        contactName,
        requesterId: userId,
        requesterName: userName,
        departmentCode,
        costCenter,
        expiryDays: expiryDays || CONFIG.defaultExpiryDays,
        privateKey: CONFIG.xsuaaPrivateKey
      });
      
      // Create invitation record
      const invitation = await INSERT.into(SupplierInvitations).entries({
        ...tokenResult.invitationData,
        invitationNotes,
        createdBy: userId
      });
      
      // Generate invitation link
      const invitationLink = `${CONFIG.invitationBaseUrl}?token=${encodeURIComponent(tokenResult.token)}`;
      
      // Audit log
      await INSERT.into(AuditLogs).entries({
        eventType: 'INVITATION_CREATED',
        invitationId: tokenResult.invitationId,
        userId: userId,
        userName: userName,
        ipAddress: req.http?.req?.ip || null,
        userAgent: req.http?.req?.headers?.['user-agent'] || null,
        eventData: JSON.stringify({
          email,
          companyName,
          expiryDays: expiryDays || CONFIG.defaultExpiryDays,
          departmentCode,
          costCenter
        }),
        timestamp: new Date()
      });
      
      // Return result
      return {
        invitationId: tokenResult.invitationId,
        invitationLink,
        expiresAt: new Date(tokenResult.expiresAt * 1000),
        email
      };
      
    } catch (error) {
      console.error('Error creating invitation:', error);
      
      // Audit log error
      await INSERT.into(AuditLogs).entries({
        eventType: 'INVITATION_CREATION_FAILED',
        userId: req.user?.id || 'system',
        userName: req.user?.name || 'System',
        ipAddress: req.http?.req?.ip || null,
        eventData: JSON.stringify({
          email,
          error: error.message
        }),
        timestamp: new Date()
      });
      
      return req.error(500, `Failed to create invitation: ${error.message}`, 'CREATION_FAILED');
    }
  });
  
  /**
   * validateToken - Verify JWT token and return invitation details
   * 
   * Authorization: Public (no authentication required)
   * Rate Limit: 5 attempts per token
   */
  srv.on('validateToken', async (req) => {
    const { token } = req.data;
    
    if (!token) {
      return {
        valid: false,
        errorCode: 'MISSING_TOKEN',
        errorMessage: 'Token parameter is required'
      };
    }
    
    try {
      // Validate token with all security checks
      const validation = await validateToken(token, {
        publicKey: CONFIG.xsuaaPublicKey,
        db: cds.db,
        ipAddress: req.http?.req?.ip,
        config: {
          maxValidationAttempts: CONFIG.maxValidationAttempts
        }
      });
      
      // Audit log successful validation
      await INSERT.into(AuditLogs).entries({
        eventType: 'TOKEN_VALIDATED',
        invitationId: validation.invitationId,
        userId: null, // External user, no XSUAA identity yet
        userName: validation.supplierEmail,
        ipAddress: req.http?.req?.ip || null,
        userAgent: req.http?.req?.headers?.['user-agent'] || null,
        eventData: JSON.stringify({
          tokenState: validation.tokenState,
          validationAttempts: validation.validationAttempts
        }),
        timestamp: new Date()
      });
      
      // Return validation result
      return {
        valid: true,
        invitationId: validation.invitationId,
        email: validation.supplierEmail,
        companyName: validation.companyName,
        contactName: validation.contactName,
        expiresAt: new Date(validation.metadata.expiresAt * 1000),
        tokenState: validation.tokenState,
        errorCode: null,
        errorMessage: null
      };
      
    } catch (error) {
      // Audit log failed validation
      await INSERT.into(AuditLogs).entries({
        eventType: 'TOKEN_VALIDATION_FAILED',
        invitationId: null,
        userId: null,
        userName: null,
        ipAddress: req.http?.req?.ip || null,
        userAgent: req.http?.req?.headers?.['user-agent'] || null,
        eventData: JSON.stringify({
          errorCode: error.code || 'UNKNOWN_ERROR',
          errorMessage: error.message
        }),
        timestamp: new Date()
      });
      
      // Format error response
      const formattedError = formatValidationError(error);
      
      return {
        valid: false,
        invitationId: null,
        email: null,
        companyName: null,
        contactName: null,
        expiresAt: null,
        tokenState: null,
        errorCode: formattedError.error.code,
        errorMessage: formattedError.error.message
      };
    }
  });
  
  /**
   * revokeInvitation - Manually revoke an active invitation
   * 
   * Authorization: invitation.manage scope
   */
  srv.on('revokeInvitation', async (req) => {
    const { invitationId, revocationReason } = req.data;
    
    try {
      const userId = req.user?.id || 'system';
      const userName = req.user?.name || 'System';
      
      // Update invitation state
      await UPDATE(SupplierInvitations)
        .set({
          tokenState: 'REVOKED',
          revokedAt: new Date(),
          revokedBy: userId,
          revocationReason: revocationReason || 'No reason provided'
        })
        .where({ ID: invitationId });
      
      // Audit log
      await INSERT.into(AuditLogs).entries({
        eventType: 'TOKEN_REVOKED',
        invitationId,
        userId,
        userName,
        ipAddress: req.http?.req?.ip || null,
        userAgent: req.http?.req?.headers?.['user-agent'] || null,
        eventData: JSON.stringify({
          reason: revocationReason || 'No reason provided'
        }),
        timestamp: new Date()
      });
      
      return {
        success: true,
        message: `Invitation ${invitationId} revoked successfully`
      };
      
    } catch (error) {
      console.error('Error revoking invitation:', error);
      
      // Audit log error
      await INSERT.into(AuditLogs).entries({
        eventType: 'REVOCATION_FAILED',
        invitationId,
        userId: req.user?.id || 'system',
        userName: req.user?.name || 'System',
        ipAddress: req.http?.req?.ip || null,
        eventData: JSON.stringify({
          error: error.message
        }),
        timestamp: new Date()
      });
      
      return req.error(500, `Failed to revoke invitation: ${error.message}`, 'REVOCATION_FAILED');
    }
  });
  
  /**
   * resendInvitation - Regenerate token and resend invitation
   * 
   * Authorization: invitation.create scope
   */
  srv.on('resendInvitation', async (req) => {
    const { invitationId, expiryDays } = req.data;
    
    try {
      // Get existing invitation
      const invitation = await SELECT.one.from(SupplierInvitations).where({ ID: invitationId });
      
      if (!invitation) {
        return req.error(404, `Invitation not found: ${invitationId}`, 'INVITATION_NOT_FOUND');
      }
      
      // Cannot resend consumed invitations
      if (invitation.tokenState === 'CONSUMED') {
        return req.error(400, 'Cannot resend consumed invitation', 'ALREADY_CONSUMED');
      }
      
      const userId = req.user?.id || 'system';
      const userName = req.user?.name || 'System';
      
      // Generate new token
      const tokenResult = generateInvitationToken({
        email: invitation.email,
        companyName: invitation.companyName,
        contactName: invitation.contactName,
        requesterId: userId,
        requesterName: userName,
        departmentCode: invitation.departmentCode,
        costCenter: invitation.costCenter,
        expiryDays: expiryDays || CONFIG.defaultExpiryDays,
        privateKey: CONFIG.xsuaaPrivateKey
      });
      
      // Update invitation record
      await UPDATE(SupplierInvitations)
        .set({
          tokenHash: tokenResult.tokenHash,
          jwtPayload: tokenResult.jwtPayload,
          tokenState: 'CREATED',
          issuedAt: new Date(tokenResult.issuedAt * 1000),
          expiresAt: new Date(tokenResult.expiresAt * 1000),
          validationAttempts: 0,
          lastValidatedAt: null,
          lastValidatedIP: null,
          modifiedAt: new Date(),
          modifiedBy: userId
        })
        .where({ ID: invitationId });
      
      // Generate invitation link
      const invitationLink = `${CONFIG.invitationBaseUrl}?token=${encodeURIComponent(tokenResult.token)}`;
      
      // Audit log
      await INSERT.into(AuditLogs).entries({
        eventType: 'INVITATION_RESENT',
        invitationId,
        userId,
        userName,
        ipAddress: req.http?.req?.ip || null,
        userAgent: req.http?.req?.headers?.['user-agent'] || null,
        eventData: JSON.stringify({
          newExpiryDays: expiryDays || CONFIG.defaultExpiryDays
        }),
        timestamp: new Date()
      });
      
      return {
        invitationLink,
        expiresAt: new Date(tokenResult.expiresAt * 1000)
      };
      
    } catch (error) {
      console.error('Error resending invitation:', error);
      return req.error(500, `Failed to resend invitation: ${error.message}`, 'RESEND_FAILED');
    }
  });
  
  /**
   * getInvitationStatus - Retrieve current invitation state
   * 
   * Authorization: invitation.audit scope (read-only)
   */
  srv.on('getInvitationStatus', async (req) => {
    const { invitationId } = req.data;
    
    const invitation = await SELECT.one.from(SupplierInvitations)
      .columns('ID', 'email', 'companyName', 'tokenState', 'issuedAt', 'expiresAt', 'validationAttempts')
      .where({ ID: invitationId });
    
    if (!invitation) {
      return req.error(404, `Invitation not found: ${invitationId}`, 'INVITATION_NOT_FOUND');
    }
    
    return {
      invitationId: invitation.ID,
      email: invitation.email,
      companyName: invitation.companyName,
      tokenState: invitation.tokenState,
      issuedAt: invitation.issuedAt,
      expiresAt: invitation.expiresAt,
      validationAttempts: invitation.validationAttempts,
      isExpired: invitation.expiresAt < new Date(),
      isActive: ['CREATED', 'SENT', 'DELIVERED', 'OPENED', 'VALIDATED'].includes(invitation.tokenState)
    };
  });
  
  // =========================================================================
  // ENTITY EVENT HANDLERS
  // =========================================================================
  
  /**
   * After reading invitations, compute virtual invitationLink field
   */
  srv.after('READ', 'Invitations', (invitations) => {
    // Handle both single object and array
    const records = Array.isArray(invitations) ? invitations : [invitations];
    
    records.forEach(invitation => {
      if (invitation && invitation.tokenHash) {
        // Note: We don't have the full JWT here, only hash
        // In real implementation, you'd need to regenerate or store the link
        invitation.invitationLink = `${CONFIG.invitationBaseUrl}?invitationId=${invitation.ID}`;
      }
    });
  });
  
  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================
  
  /**
   * Log audit event (internal helper)
   */
  async function logAuditEvent(eventType, invitationId, userId, eventData, req) {
    try {
      await INSERT.into(AuditLogs).entries({
        eventType,
        invitationId: invitationId || null,
        userId: userId || null,
        userName: req?.user?.name || null,
        ipAddress: req?.http?.req?.ip || null,
        userAgent: req?.http?.req?.headers?.['user-agent'] || null,
        eventData: typeof eventData === 'string' ? eventData : JSON.stringify(eventData),
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
  
  // Expose for testing
  srv._logAuditEvent = logAuditEvent;
  
};
