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

/**
 * SupplierInvitations - Validations and UI Metadata
 */
annotate SupplierInvitations with {
  // Contact Information
  email @title: 'Email Address'
        @description: 'Supplier contact email for invitation delivery'
        @mandatory
        @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  
  companyName @title: 'Company Name'
              @description: 'Supplier company name (optional, for reference)';
  
  contactName @title: 'Contact Person'
              @description: 'Name of supplier contact person (optional)';
  
  // Token Lifecycle (Read-only)
  tokenState @title: 'Token Status'
             @description: 'Current state in 9-state lifecycle'
             @readonly;
  
  tokenHash @title: 'Token Hash'
            @description: 'SHA-256 hash for token lookup'
            @readonly;
  
  issuedAt @title: 'Issued At'
           @description: 'Token generation timestamp'
           @readonly;
  
  expiresAt @title: 'Expires At'
            @description: 'Token expiration timestamp'
            @readonly;
  
  // Business Context
  departmentCode @title: 'Department Code'
                 @description: 'Department for ABAC filtering';
  
  costCenter @title: 'Cost Center'
             @description: 'Cost center for ABAC filtering';
  
  invitedBy @title: 'Invited By'
            @description: 'Email of internal user who created invitation';
  
  invitationNotes @title: 'Internal Notes'
                  @description: 'Notes for internal users (not visible to supplier)';
}

/**
 * SupplierOnboardingData - Comprehensive Validations and UI Metadata
 */
annotate SupplierOnboardingData with {
  // Company Information
  companyLegalName @title: 'Company Legal Name'
                   @description: 'Official registered name of the company'
                   @mandatory
                   @assert.notNull
                   @assert.range: [2, 255];
  
  taxId @title: 'Tax Identification Number'
        @description: 'Government-issued tax identifier (TIN/EIN)'
        @assert.format: '^[A-Z0-9]{5,20}$';
  
  vatNumber @title: 'VAT Number'
            @description: 'Value Added Tax registration number'
            @assert.format: '^[A-Z0-9]{5,20}$';
  
  dunsNumber @title: 'D-U-N-S Number'
             @description: 'Dun & Bradstreet business identifier'
             @assert.format: '^[0-9]{9}$';
  
  businessRegistration @title: 'Business Registration Number'
                       @description: 'Commercial register or company registration number';
  
  // Address Information
  street @title: 'Street Address'
         @description: 'Street name and number';
  
  city @title: 'City'
       @description: 'City or municipality';
  
  region @title: 'State/Province/Region'
         @description: 'State, province, or administrative region';
  
  postalCode @title: 'Postal Code'
             @description: 'ZIP or postal code'
             @assert.format: '^[A-Z0-9 -]{3,10}$';
  
  country @title: 'Country'
          @description: 'Country where company is registered'
          @mandatory
          @assert.notNull;
  
  // Contact Details
  primaryContactName @title: 'Primary Contact Name'
                     @description: 'Full name of primary contact person'
                     @mandatory
                     @assert.notNull
                     @assert.range: [2, 255];
  
  primaryContactEmail @title: 'Primary Contact Email'
                      @description: 'Email address of primary contact'
                      @mandatory
                      @assert.notNull
                      @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  
  primaryContactPhone @title: 'Primary Contact Phone'
                      @description: 'Phone number of primary contact (E.164 format recommended)'
                      @assert.format: '^\+?[1-9]\d{6,14}$';
  
  // Banking Information
  bankName @title: 'Bank Name'
           @description: 'Name of banking institution';
  
  bankAccountNumber @title: 'Bank Account Number'
                    @description: 'Bank account number (encrypted in production)';
  
  bankRoutingNumber @title: 'Bank Routing Number'
                    @description: 'Bank routing/sort code';
  
  swiftCode @title: 'SWIFT/BIC Code'
            @description: 'Bank Identifier Code for international transfers'
            @assert.format: '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$';
  
  iban @title: 'IBAN'
       @description: 'International Bank Account Number'
       @assert.format: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$';
  
  // Business Details
  yearEstablished @title: 'Year Established'
                  @description: 'Year company was founded'
                  @assert.range: [1800, 2100];
  
  numberOfEmployees @title: 'Number of Employees'
                    @description: 'Approximate employee count'
                    @assert.range: [0, 999999999];
  
  annualRevenue @title: 'Annual Revenue'
                @description: 'Approximate annual revenue';
  
  currency @title: 'Currency'
           @description: 'Currency for annual revenue';
  
  websiteUrl @title: 'Website URL'
             @description: 'Company website address'
             @assert.format: '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}';
  
  businessDescription @title: 'Business Description'
                      @description: 'Brief description of business activities';
  
  // Industry Classification
  industryCode @title: 'Industry Code'
               @description: 'NAICS or SIC industry classification code';
  
  commodities @title: 'Commodities'
              @description: 'Comma-separated list of products/services offered';
  
  // Payment Terms
  preferredPaymentTerms @title: 'Preferred Payment Terms'
                        @description: 'e.g., Net 30, Net 60, Net 90';
  
  preferredCurrency @title: 'Preferred Currency'
                    @description: 'Currency for invoicing';
  
  // Status Tracking (Read-only)
  onboardingStatus @title: 'Onboarding Status'
                   @description: 'Current status in onboarding workflow'
                   @readonly;
  
  submittedAt @title: 'Submitted At'
              @description: 'Timestamp when supplier submitted data'
              @readonly;
  
  reviewedAt @title: 'Reviewed At'
             @description: 'Timestamp when purchaser reviewed submission'
             @readonly;
  
  reviewedBy @title: 'Reviewed By'
             @description: 'Email of user who reviewed submission'
             @readonly;
  
  reviewNotes @title: 'Review Notes'
              @description: 'Internal notes from purchaser review'
              @readonly;
  
  approvalDate @title: 'Approval Date'
               @description: 'Timestamp when submission was approved'
               @readonly;
  
  approvedBy @title: 'Approved By'
             @description: 'Email of user who approved submission'
             @readonly;
  
  // S/4HANA Integration (Read-only)
  s4BusinessPartnerId @title: 'S/4HANA Business Partner ID'
                      @description: 'BP ID after successful sync to S/4HANA'
                      @readonly;
  
  s4VendorId @title: 'S/4HANA Vendor ID'
             @description: 'Vendor ID after successful sync to S/4HANA'
             @readonly;
  
  s4SyncedAt @title: 'Synced At'
             @description: 'Timestamp of last successful S/4HANA sync'
             @readonly;
  
  s4SyncStatus @title: 'Sync Status'
               @description: 'Status of S/4HANA synchronization'
               @readonly;
}

/**
 * AttachmentMetadata - Validations and UI Metadata
 */
annotate AttachmentMetadata with {
  fileName @title: 'File Name'
           @description: 'Original file name from upload'
           @mandatory
           @assert.notNull;
  
  fileSize @title: 'File Size'
           @description: 'File size in bytes'
           @assert.range: [0, 5242880]; // 5 MB max
  
  mimeType @title: 'MIME Type'
           @description: 'File content type (e.g., application/pdf, image/jpeg)';
  
  attachmentType @title: 'Attachment Type'
                 @description: 'Category of document (tax cert, license, etc.)'
                 @mandatory
                 @assert.notNull;
  
  description @title: 'Description'
              @description: 'Brief description of document contents';
  
  storageKey @title: 'Storage Key'
             @description: 'Object Store S3 key for file retrieval'
             @readonly;
  
  bucketName @title: 'Bucket Name'
             @description: 'Object Store bucket name'
             @readonly;
  
  uploadedBy @title: 'Uploaded By'
             @description: 'Email of user who uploaded document';
  
  virusScanStatus @title: 'Virus Scan Status'
                  @description: 'Status of malware scanning (CLEAN, INFECTED, PENDING)'
                  @readonly;
  
  expiryDate @title: 'Expiry Date'
             @description: 'Date when document expires or is archived';
}

/**
 * AuditLogs - UI Metadata (Entire entity is immutable/readonly)
 */
annotate AuditLogs with @readonly {
  timestamp @title: 'Timestamp'
            @description: 'Event occurrence time';
  
  eventType @title: 'Event Type'
            @description: 'Classification of audit event';
  
  eventCategory @title: 'Event Category'
                @description: 'SECURITY, BUSINESS, or INTEGRATION';
  
  severity @title: 'Severity'
           @description: 'INFO, WARNING, ERROR, or CRITICAL';
  
  eventDescription @title: 'Event Description'
                   @description: 'Human-readable description of what happened';
  
  actorId @title: 'Actor ID'
          @description: 'User ID or system identifier';
  
  actorEmail @title: 'Actor Email'
             @description: 'Email of user who performed action';
  
  actorRole @title: 'Actor Role'
            @description: 'Role of actor (Purchaser, Admin, Auditor, Supplier)';
  
  ipAddress @title: 'IP Address'
            @description: 'IP address of request origin';
  
  correlationId @title: 'Correlation ID'
                @description: 'Distributed tracing identifier';
}
