namespace supplierOnboarding;

using { cuid, managed, Country, Currency } from '@sap/cds/common';

/**
 * Domain Model for Supplier Self-Onboarding System
 * Following SAP CAP standards: cuid, managed aspects, pluralized names
 * Security: Token-based authentication with 9-state lifecycle
 */

//=============================================================================
// ENUMERATIONS & TYPES
//=============================================================================

/**
 * Token lifecycle states (9-state machine from security architecture)
 * Flow: CREATED → SENT → DELIVERED → OPENED → VALIDATED → CONSUMED
 * Errors: FAILED, EXPIRED, REVOKED
 */
type TokenState : String enum {
  CREATED   = 'CREATED';    // Token generated but not sent
  SENT      = 'SENT';       // Email sent via SendGrid
  DELIVERED = 'DELIVERED';  // Email delivery confirmed
  OPENED    = 'OPENED';     // Supplier opened email
  VALIDATED = 'VALIDATED';  // Token signature verified
  CONSUMED  = 'CONSUMED';   // Supplier completed onboarding
  FAILED    = 'FAILED';     // Email delivery failure
  EXPIRED   = 'EXPIRED';    // Token past expiration
  REVOKED   = 'REVOKED';    // Admin manually revoked
}

/**
 * Onboarding completion status
 */
type OnboardingStatus : String enum {
  DRAFT              = 'DRAFT';              // Supplier started but not submitted
  SUBMITTED          = 'SUBMITTED';          // Awaiting purchaser review
  UNDER_REVIEW       = 'UNDER_REVIEW';       // Purchaser reviewing data
  APPROVED           = 'APPROVED';           // Ready for S/4HANA sync
  SYNCED_TO_S4       = 'SYNCED_TO_S4';       // Business Partner created
  REJECTED           = 'REJECTED';           // Purchaser rejected
  ADDITIONAL_INFO    = 'ADDITIONAL_INFO';    // Requires more documents
}

/**
 * Attachment types
 */
type AttachmentType : String enum {
  TAX_CERTIFICATE           = 'TAX_CERTIFICATE';
  BUSINESS_LICENSE          = 'BUSINESS_LICENSE';
  BANK_DETAILS              = 'BANK_DETAILS';
  COMPANY_REGISTRATION      = 'COMPANY_REGISTRATION';
  ISO_CERTIFICATE           = 'ISO_CERTIFICATE';
  OTHER_DOCUMENT            = 'OTHER_DOCUMENT';
}

/**
 * Audit event types
 */
type AuditEventType : String enum {
  INVITATION_CREATED        = 'INVITATION_CREATED';
  TOKEN_SENT                = 'TOKEN_SENT';
  TOKEN_VALIDATED           = 'TOKEN_VALIDATED';
  ONBOARDING_STARTED        = 'ONBOARDING_STARTED';
  DATA_SUBMITTED            = 'DATA_SUBMITTED';
  DOCUMENT_UPLOADED         = 'DOCUMENT_UPLOADED';
  STATUS_CHANGED            = 'STATUS_CHANGED';
  ADMIN_ACTION              = 'ADMIN_ACTION';
  S4_SYNC_SUCCESS           = 'S4_SYNC_SUCCESS';
  S4_SYNC_FAILURE           = 'S4_SYNC_FAILURE';
  TOKEN_EXPIRED             = 'TOKEN_EXPIRED';
  TOKEN_REVOKED             = 'TOKEN_REVOKED';
}

//=============================================================================
// CORE ENTITIES
//=============================================================================

/**
 * SupplierInvitations - JWT magic link tokens with 9-state lifecycle
 * 
 * Security Features:
 * - Single-use enforcement via tokenState
 * - RS256 signature validation
 * - 7-day expiration (configurable)
 * - Rate limiting: max 5 validation attempts per hour
 */
entity SupplierInvitations : cuid, managed {
  // Supplier contact information
  email                 : String(255) not null;
  companyName           : String(255);
  contactName           : String(255);
  
  // JWT token (stored for revocation/audit, not for validation)
  tokenHash             : String(64);         // SHA-256 hash of JWT for lookups
  jwtPayload            : LargeString;        // Full JWT payload (JSON)
  
  // Token lifecycle
  tokenState            : TokenState not null default 'CREATED';
  issuedAt              : Timestamp not null;
  expiresAt             : Timestamp not null;
  validatedAt           : Timestamp;
  consumedAt            : Timestamp;
  revokedAt             : Timestamp;
  revokedBy             : String(255);
  revocationReason      : String(1000);
  
  // Email delivery tracking
  emailSentAt           : Timestamp;
  emailDeliveredAt      : Timestamp;
  emailOpenedAt         : Timestamp;
  emailProvider         : String(50) default 'SendGrid';
  emailMessageId        : String(255);        // SendGrid message ID
  
  // Rate limiting & security
  validationAttempts    : Integer default 0;
  lastValidationAttempt : Timestamp;
  ipAddressFirstAccess  : String(45);         // IPv4 or IPv6
  userAgentFirstAccess  : String(500);
  
  // Business context
  departmentCode        : String(50);         // For ABAC filtering
  costCenter            : String(50);         // For ABAC filtering
  invitedBy             : String(255);        // Purchaser email
  invitationNotes       : String(2000);       // Internal notes
  
  // Relationships
  onboardingData        : Association to SupplierOnboardingData on onboardingData.invitation = $self;
  auditLogs             : Association to many AuditLogs on auditLogs.invitation = $self;
}

/**
 * SupplierOnboardingData - Supplier-submitted information
 * 
 * Represents data entered by external supplier via Build Apps UI
 * Will be synchronized to S/4HANA Business Partner after approval
 */
entity SupplierOnboardingData : cuid, managed {
  // Link to invitation token
  invitation            : Association to SupplierInvitations not null;
  
  // Company Information
  companyLegalName      : String(255) not null;
  taxId                 : String(50);
  vatNumber             : String(50);
  dunsNumber            : String(20);
  businessRegistration  : String(100);
  
  // Contact Details
  street                : String(255);
  city                  : String(100);
  region                : String(100);        // State/Province
  postalCode            : String(20);
  country               : Country;
  
  primaryContactName    : String(255);
  primaryContactEmail   : String(255);
  primaryContactPhone   : String(50);
  
  // Banking Information (sensitive)
  bankName              : String(255);
  bankAccountNumber     : String(100);        // Encrypted in production
  bankRoutingNumber     : String(50);
  swiftCode             : String(20);
  iban                  : String(50);
  
  // Business Details
  yearEstablished       : Integer;
  numberOfEmployees     : Integer;
  annualRevenue         : Decimal(15,2);
  currency              : Currency;
  websiteUrl            : String(500);
  businessDescription   : String(2000);
  
  // Industry Classification
  industryCode          : String(20);         // NAICS or SIC code
  commodities           : String(1000);       // Comma-separated list
  
  // Payment Terms
  preferredPaymentTerms : String(100);        // e.g., "Net 30", "Net 60"
  preferredCurrency     : Currency;
  
  // Status tracking
  onboardingStatus      : OnboardingStatus not null default 'DRAFT';
  submittedAt           : Timestamp;
  reviewedAt            : Timestamp;
  reviewedBy            : String(255);
  reviewNotes           : String(2000);
  approvalDate          : Timestamp;
  approvedBy            : String(255);
  
  // S/4HANA integration
  s4BusinessPartnerId   : String(50);         // BP ID after successful sync
  s4VendorId            : String(50);         // Vendor ID after successful sync
  s4SyncedAt            : Timestamp;
  s4SyncStatus          : String(50);
  s4SyncErrors          : LargeString;        // JSON array of errors
  
  // Relationships
  attachments           : Composition of many AttachmentMetadata on attachments.onboardingData = $self;
  auditLogs             : Association to many AuditLogs on auditLogs.onboardingData = $self;
}

/**
 * AttachmentMetadata - Document uploads (BTP Object Store references)
 * 
 * Uses composition (parent-child) with cascading delete
 * Actual files stored in S3-compatible BTP Object Store
 */
entity AttachmentMetadata : cuid, managed {
  // Parent relationship (composition)
  onboardingData        : Association to SupplierOnboardingData not null;
  
  // File metadata
  fileName              : String(255) not null;
  fileSize              : Integer;            // Bytes
  mimeType              : String(100);
  attachmentType        : AttachmentType not null;
  description           : String(500);
  
  // Object Store reference
  storageKey            : String(500) not null;  // S3 object key
  bucketName            : String(100) default 'onboarding-documents';
  storageRegion         : String(50);
  
  // Security
  uploadedBy            : String(255);        // Supplier email or admin
  virusScanStatus       : String(20);         // CLEAN, INFECTED, PENDING
  virusScanDate         : Timestamp;
  
  // Access control
  expiryDate            : Timestamp;          // For presigned URL generation
  isArchived            : Boolean default false;
  archivedAt            : Timestamp;
}

/**
 * AuditLogs - Comprehensive audit trail
 * 
 * Immutable event log for compliance (GDPR, SOX, financial audit)
 * Retention: 7 years minimum (configurable)
 */
entity AuditLogs : cuid {
  // Timestamp (not using managed aspect to prevent modification)
  timestamp             : Timestamp not null @cds.on.insert: $now;
  
  // Event classification
  eventType             : AuditEventType not null;
  eventCategory         : String(50);         // SECURITY, BUSINESS, INTEGRATION
  severity              : String(20);         // INFO, WARNING, ERROR, CRITICAL
  
  // Context
  invitation            : Association to SupplierInvitations;
  onboardingData        : Association to SupplierOnboardingData;
  
  // Actor (who performed the action)
  actorId               : String(255);        // User ID or system
  actorEmail            : String(255);
  actorRole             : String(100);        // Purchaser, Admin, Auditor, Supplier
  
  // Technical details
  ipAddress             : String(45);
  userAgent             : String(500);
  sessionId             : String(100);
  correlationId         : String(100);        // For distributed tracing
  
  // Event data
  eventDescription      : String(2000) not null;
  oldValue              : LargeString;        // JSON before state
  newValue              : LargeString;        // JSON after state
  errorMessage          : String(2000);
  stackTrace            : LargeString;
  
  // Compliance flags
  isPII                 : Boolean default false;
  isFinancial           : Boolean default false;
  requiresNotification  : Boolean default false;
  
  // Data retention
  retentionPeriodDays   : Integer default 2555;  // 7 years
  archiveAfter          : Timestamp;
}

//=============================================================================
// ANNOTATIONS & METADATA
//=============================================================================

// Field-level annotations for UI and validation
annotate SupplierInvitations with {
  email @mandatory @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  tokenState @readonly;
  tokenHash @readonly;
}

annotate SupplierOnboardingData with {
  companyLegalName @mandatory;
  country @mandatory;
  onboardingStatus @readonly;
}

annotate AttachmentMetadata with {
  fileName @mandatory;
  attachmentType @mandatory;
  storageKey @readonly;
}

annotate AuditLogs with @readonly {
  // Entire entity is immutable
  timestamp;
  eventType;
  eventDescription;
}
