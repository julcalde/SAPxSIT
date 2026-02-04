using { supplierOnboarding as db } from '../db/schema';

/**
 * AdminService - Read-only service for auditors and compliance
 * 
 * Purpose: Provide comprehensive audit trail and monitoring capabilities
 * Access: Requires XSUAA authentication with invitation.audit scope
 * 
 * Capabilities:
 * - View all supplier invitations (across departments)
 * - Review all onboarding submissions
 * - Access complete audit log (immutable event trail)
 * - Monitor system health and metrics
 * - Generate compliance reports
 * 
 * Security:
 * - All entities are read-only (@readonly)
 * - Requires 'invitation.audit' scope
 * - No create, update, or delete operations
 * - ABAC support for department-level filtering (optional)
 */
@(path: '/admin')
@(requires: 'invitation.audit')
service AdminService {
  
  //===========================================================================
  // ENTITIES (Read-only views for auditors)
  //===========================================================================
  
  /**
   * Invitations - Complete invitation history
   * 
   * Auditors can view:
   * - All invitation records (no department filtering)
   * - Full token lifecycle (all 9 states)
   * - Email delivery tracking
   * - Validation attempts and IP addresses
   * - Revocation history
   */
  @readonly
  @cds.redirection.target: true
  entity Invitations as projection on db.SupplierInvitations {
    *,
    onboardingData,
    auditLogs
  };
  
  /**
   * OnboardingSubmissions - All supplier data submissions
   * 
   * Auditors can review:
   * - Submitted company information
   * - Contact details
   * - Banking information (read-only, encrypted fields not exposed)
   * - Business classifications
   * - S/4HANA synchronization status
   * - Approval/rejection workflow
   */
  @readonly
  @cds.redirection.target: true
  entity OnboardingSubmissions as projection on db.SupplierOnboardingData {
    *,
    invitation,
    attachments
  } excluding {
    // Exclude highly sensitive fields (encryption keys, raw bank data)
    bankAccountNumber,  // Should be encrypted, not visible even to auditors
    bankRoutingNumber
  };
  
  /**
   * Attachments - Document metadata and access logs
   * 
   * Auditors can see:
   * - What documents were uploaded
   * - File metadata (size, type, upload timestamp)
   * - Virus scan results
   * - Storage location (for compliance verification)
   * 
   * Note: Presigned URLs require separate function call (audit logged)
   */
  @readonly
  entity Attachments as projection on db.AttachmentMetadata {
    *,
    onboardingData
  };
  
  /**
   * AuditLogs - Immutable event trail
   * 
   * Complete audit log for compliance:
   * - All security events (token validation, rate limiting, failures)
   * - Business events (invitations, submissions, S/4HANA sync)
   * - Administrative actions (revocations, approvals)
   * - Integration events (S/4HANA success/failure, Object Store ops)
   * - Data classification flags (PII, financial)
   * - 7-year retention period
   */
  @readonly
  @cds.redirection.target: true
  entity AuditLogs as projection on db.AuditLogs {
    *,
    invitation,
    onboardingData
  };
  
  //===========================================================================
  // VIEWS (Aggregated data for reporting)
  //===========================================================================
  
  /**
   * InvitationSummary - Aggregated metrics by state
   * 
   * Provides quick overview:
   * - Count by tokenState (CREATED, SENT, VALIDATED, CONSUMED, etc.)
   * - Average time to consumption
   * - Conversion rate (CREATED → CONSUMED)
   * - Expiration rate
   */
  @readonly
  entity InvitationSummary as
    select from db.SupplierInvitations {
      tokenState,
      count(*) as totalCount : Integer,
      min(issuedAt) as earliestIssued : Timestamp,
      max(issuedAt) as latestIssued : Timestamp
    }
    group by tokenState;
  
  /**
   * OnboardingStatusSummary - Aggregated metrics by onboarding status
   * 
   * Tracks submission pipeline:
   * - DRAFT (started but not submitted)
   * - SUBMITTED (awaiting review)
   * - APPROVED (ready for S/4HANA)
   * - SYNCED_TO_S4 (successfully integrated)
   * - REJECTED (failed validation)
   */
  @readonly
  entity OnboardingStatusSummary as
    select from db.SupplierOnboardingData {
      onboardingStatus,
      count(*) as totalCount : Integer,
      min(submittedAt) as earliestSubmission : Timestamp,
      max(submittedAt) as latestSubmission : Timestamp
    }
    group by onboardingStatus;
  
  /**
   * DailyMetrics - Daily activity tracking
   * 
   * For trend analysis and capacity planning:
   * - Invitations created per day
   * - Submissions per day
   * - S/4HANA sync success rate
   */
  @readonly
  entity DailyMetrics as
    select from db.AuditLogs {
      eventType,
      count(*) as eventCount : Integer,
      count(distinct actorEmail) as uniqueActors : Integer
    }
    group by eventType;
  
  //===========================================================================
  // FUNCTIONS (Read-only queries for compliance reports)
  //===========================================================================
  
  /**
   * getInvitationHistory - Complete timeline for specific invitation
   * 
   * Returns chronological audit trail:
   * - Creation event
   * - Email delivery events
   * - Token validation attempts
   * - Onboarding submission
   * - S/4HANA synchronization
   * - Any administrative actions
   * 
   * Use Case: Compliance investigation, troubleshooting
   */
  function getInvitationHistory(
    invitationId : UUID not null
  ) returns array of {
    timestamp       : Timestamp;
    eventType       : String;
    eventCategory   : String;
    severity        : String;
    actorEmail      : String;
    eventDescription: String;
    ipAddress       : String;
    oldValue        : String;
    newValue        : String;
  };
  
  /**
   * getSecurityEvents - Filter audit log by security events
   * 
   * Returns events related to:
   * - Failed token validations
   * - Rate limit violations
   * - Token revocations
   * - Expired tokens
   * - Suspicious IP patterns
   * 
   * Parameters:
   * - startDate: Filter from this date
   * - endDate: Filter to this date
   * - severity: INFO, WARNING, ERROR, CRITICAL
   * 
   * Use Case: Security monitoring, incident response
   */
  function getSecurityEvents(
    startDate : Date not null,
    endDate   : Date not null,
    severity  : String  // Optional filter
  ) returns array of {
    timestamp       : Timestamp;
    eventType       : String;
    severity        : String;
    invitationId    : UUID;
    actorId         : String;
    ipAddress       : String;
    eventDescription: String;
    errorMessage    : String;
  };
  
  /**
   * getComplianceReport - Generate GDPR/SOX compliance report
   * 
   * Returns summary for audit period:
   * - Total PII records processed
   * - Financial data submissions
   * - Data retention compliance
   * - Access logs (who accessed what)
   * - Data deletion events
   * 
   * Use Case: Regulatory compliance, annual audits
   */
  function getComplianceReport(
    startDate : Date not null,
    endDate   : Date not null
  ) returns {
    totalInvitations      : Integer;
    totalSubmissions      : Integer;
    piiEventsCount        : Integer;
    financialEventsCount  : Integer;
    securityEventsCount   : Integer;
    retentionCompliant    : Boolean;
    accessLogCount        : Integer;
    dataByDepartment      : array of {
      departmentCode  : String;
      invitationCount : Integer;
      submissionCount : Integer;
    };
  };
  
  /**
   * getS4HANASyncStatus - Monitor S/4HANA integration health
   * 
   * Returns synchronization metrics:
   * - Success rate (last 24h, last 7d, last 30d)
   * - Failed syncs with error details
   * - Average sync duration
   * - Pending syncs
   * 
   * Use Case: Integration monitoring, troubleshooting
   */
  function getS4HANASyncStatus(
    days : Integer default 7
  ) returns {
    totalSyncAttempts   : Integer;
    successfulSyncs     : Integer;
    failedSyncs         : Integer;
    successRate         : Decimal(5,2);
    pendingSyncs        : Integer;
    averageSyncDuration : Integer;  // milliseconds
    lastSyncTimestamp   : Timestamp;
    errors              : array of {
      onboardingId  : UUID;
      errorMessage  : String;
      attemptedAt   : Timestamp;
    };
  };
  
  /**
   * exportAuditLogs - Export audit logs for archival
   * 
   * Returns filtered audit logs in structured format
   * for long-term archival or external SIEM integration
   * 
   * Parameters:
   * - startDate: Export from this date
   * - endDate: Export to this date
   * - eventCategory: SECURITY, BUSINESS, INTEGRATION
   * - includesPII: Boolean filter for PII events
   * 
   * Use Case: Data archival, SIEM integration, forensics
   */
  function exportAuditLogs(
    startDate     : Date not null,
    endDate       : Date not null,
    eventCategory : String,
    includesPII   : Boolean
  ) returns array of {
    timestamp         : Timestamp;
    eventType         : String;
    eventCategory     : String;
    severity          : String;
    actorEmail        : String;
    invitationId      : UUID;
    eventDescription  : String;
    isPII             : Boolean;
    isFinancial       : Boolean;
    correlationId     : String;
  };
}
