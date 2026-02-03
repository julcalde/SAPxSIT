using { supplierOnboarding as db } from '../db/schema';

/**
 * InvitationService - Internal service for purchasers and admins
 * 
 * Purpose: Manage supplier invitation lifecycle
 * Access: Requires XSUAA authentication with invitation.create or invitation.manage scopes
 * 
 * Capabilities:
 * - Create new supplier invitations (generates JWT magic link)
 * - Validate tokens (external suppliers use this)
 * - Revoke active invitations
 * - Monitor invitation status
 * - Generate presigned URLs for document access
 */
@(path: '/invitation')
@(requires: 'authenticated-user')
service InvitationService {
  
  //===========================================================================
  // ENTITIES (Projections on Domain Model)
  //===========================================================================
  
  /**
   * SupplierInvitations - Full CRUD access for purchasers/admins
   * External suppliers cannot access this directly (use SupplierService)
   */
  @restrict: [
    { grant: ['READ'],                        to: ['invitation.audit'] },
    { grant: ['READ', 'CREATE'],              to: ['invitation.create'] },
    { grant: ['READ', 'CREATE', 'UPDATE'],    to: ['invitation.manage'] }
  ]
  entity Invitations as projection on db.SupplierInvitations {
    *,
    // Virtual field for invitation link (computed in handler)
    virtual invitationLink : String,
    
    // Associations
    onboardingData,
    auditLogs
  } excluding {
    // Hide sensitive fields from direct entity access
    jwtPayload,
    tokenHash
  };
  
  /**
   * OnboardingData - Read access for monitoring submitted data
   * Purchasers/admins can review supplier submissions
   */
  @restrict: [
    { grant: ['READ'],               to: ['invitation.audit'] },
    { grant: ['READ', 'UPDATE'],     to: ['invitation.manage'] }
  ]
  @readonly
  entity OnboardingData as projection on db.SupplierOnboardingData {
    *,
    invitation,
    attachments
  };
  
  /**
   * AuditLogs - Read-only audit trail
   * Immutable event log for compliance
   */
  @restrict: [
    { grant: 'READ', to: ['invitation.audit', 'invitation.manage'] }
  ]
  @readonly
  entity AuditLogs as projection on db.AuditLogs;
  
  //===========================================================================
  // ACTIONS (State-changing operations)
  //===========================================================================
  
  /**
   * createInvitation - Generate new supplier invitation
   * 
   * Flow:
   * 1. Validate input (email format, company name)
   * 2. Check for duplicate active invitations
   * 3. Generate JWT token with RS256 signature
   * 4. Create invitation record in database
   * 5. Return invitation link (to be sent via email)
   * 
   * Authorization: Requires 'invitation.create' scope
   * Rate Limit: 100 invitations per hour per user
   * Audit: Logs INVITATION_CREATED event
   */
  @restrict: [
    { grant: 'EXECUTE', to: 'invitation.create' }
  ]
  action createInvitation(
    email           : String not null,
    companyName     : String,
    contactName     : String,
    departmentCode  : String,
    costCenter      : String,
    invitationNotes : String,
    expiryDays      : Integer default 7
  ) returns {
    invitationId    : UUID;
    invitationLink  : String;
    expiresAt       : Timestamp;
    email           : String;
  };
  
  /**
   * validateToken - Verify JWT token and return invitation details
   * 
   * Flow:
   * 1. Decode JWT and verify signature (RS256 against XSUAA public key)
   * 2. Check expiration timestamp
   * 3. Query database for invitation status
   * 4. Validate state (not CONSUMED, EXPIRED, REVOKED)
   * 5. Check rate limiting (max 5 attempts per hour)
   * 6. Update tokenState to VALIDATED
   * 7. Record validation attempt (IP, user agent)
   * 8. Return invitation details
   * 
   * Authorization: Public endpoint (no authentication required)
   * Rate Limit: 5 validation attempts per token per hour
   * Audit: Logs TOKEN_VALIDATED event
   * 
   * Security:
   * - Single-use enforcement via state machine
   * - Rate limiting prevents brute force
   * - IP tracking for anomaly detection
   */
  action validateToken(
    token : String not null
  ) returns {
    valid           : Boolean;
    invitationId    : UUID;
    email           : String;
    companyName     : String;
    contactName     : String;
    expiresAt       : Timestamp;
    tokenState      : String;
    errorCode       : String;
    errorMessage    : String;
  };
  
  /**
   * revokeInvitation - Manually revoke an active invitation
   * 
   * Flow:
   * 1. Validate invitation exists and is active
   * 2. Update tokenState to REVOKED
   * 3. Record revocation metadata (who, when, why)
   * 4. Audit log the action
   * 
   * Authorization: Requires 'invitation.manage' scope
   * Use Cases:
   * - Supplier no longer needed
   * - Security concern (token leaked)
   * - Administrative cleanup
   * 
   * Audit: Logs TOKEN_REVOKED event
   */
  @restrict: [
    { grant: 'EXECUTE', to: 'invitation.manage' }
  ]
  action revokeInvitation(
    invitationId      : UUID not null,
    revocationReason  : String
  ) returns {
    success         : Boolean;
    message         : String;
  };
  
  /**
   * resendInvitation - Regenerate and resend invitation email
   * 
   * Flow:
   * 1. Check invitation is not CONSUMED or EXPIRED
   * 2. Generate new JWT token (new expiry)
   * 3. Update invitation record
   * 4. Return new invitation link
   * 
   * Authorization: Requires 'invitation.create' scope
   * Note: Does NOT send email (handled separately via SendGrid integration)
   */
  @restrict: [
    { grant: 'EXECUTE', to: 'invitation.create' }
  ]
  action resendInvitation(
    invitationId : UUID not null,
    expiryDays   : Integer default 7
  ) returns {
    invitationLink  : String;
    expiresAt       : Timestamp;
  };
  
  //===========================================================================
  // FUNCTIONS (Read-only queries)
  //===========================================================================
  
  /**
   * getInvitationStatus - Retrieve current invitation state
   * 
   * Returns comprehensive status including:
   * - Token lifecycle state
   * - Email delivery tracking
   * - Validation attempts
   * - Onboarding submission status
   * 
   * Authorization: Requires 'invitation.audit' scope
   */
  @restrict: [
    { grant: 'EXECUTE', to: ['invitation.audit', 'invitation.manage'] }
  ]
  function getInvitationStatus(
    invitationId : UUID not null
  ) returns {
    invitationId        : UUID;
    email               : String;
    companyName         : String;
    tokenState          : String;
    onboardingStatus    : String;
    issuedAt            : Timestamp;
    expiresAt           : Timestamp;
    emailSentAt         : Timestamp;
    emailDeliveredAt    : Timestamp;
    emailOpenedAt       : Timestamp;
    validatedAt         : Timestamp;
    consumedAt          : Timestamp;
    validationAttempts  : Integer;
    hasOnboardingData   : Boolean;
  };
  
  /**
   * generatePresignedUrl - Create time-limited URL for document access
   * 
   * Flow:
   * 1. Verify user has access to the invitation
   * 2. Query attachment metadata from Object Store
   * 3. Generate presigned S3 GET URL (5 min expiry)
   * 4. Return URL for frontend download
   * 
   * Authorization: Requires 'invitation.audit' scope
   * Use Case: Purchasers reviewing supplier documents
   * 
   * Security:
   * - URLs expire after 5 minutes
   * - Access control via ABAC (department/cost center)
   */
  @restrict: [
    { grant: 'EXECUTE', to: ['invitation.audit', 'invitation.manage'] }
  ]
  function generatePresignedUrl(
    attachmentId : UUID not null
  ) returns {
    presignedUrl  : String;
    expiresAt     : Timestamp;
    fileName      : String;
    mimeType      : String;
  };
  
  /**
   * getInvitationsByDepartment - Filter invitations by ABAC attributes
   * 
   * Supports multi-department organizations where purchasers
   * should only see invitations from their own department
   * 
   * Authorization: Requires 'invitation.audit' scope
   * ABAC: Filters by user's departmentCode attribute
   */
  @restrict: [
    { grant: 'EXECUTE', to: ['invitation.audit', 'invitation.manage'] }
  ]
  function getInvitationsByDepartment(
    departmentCode : String not null,
    status         : String  // Optional filter by tokenState
  ) returns array of {
    invitationId  : UUID;
    email         : String;
    companyName   : String;
    tokenState    : String;
    issuedAt      : Timestamp;
    expiresAt     : Timestamp;
  };
}
