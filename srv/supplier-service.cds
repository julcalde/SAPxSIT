using { supplierOnboarding as db } from '../db/schema';

/**
 * SupplierService - External service for suppliers (token-based access)
 * 
 * Purpose: Enable external suppliers to complete self-onboarding
 * Access: Token-based (no XSUAA authentication) - validates JWT magic link
 * 
 * Capabilities:
 * - Submit onboarding data (company info, contacts, bank details)
 * - Upload attachments (tax certificates, licenses, etc.)
 * - Save draft data (progressive form filling)
 * - Retrieve own onboarding data for review
 * 
 * Security:
 * - All operations require valid JWT token in request
 * - Token validated on every request (signature + expiry + state)
 * - Single-use enforcement (CONSUMED state check)
 * - Rate limiting per token
 */
@(path: '/supplier')
service SupplierService {
  
  //===========================================================================
  // ENTITIES (Limited projections for external suppliers)
  //===========================================================================
  
  /**
   * MyOnboardingData - Supplier's own submission data
   * 
   * Access Control:
   * - No @restrict annotation (custom token validation in handler)
   * - Token-based authorization (req.headers.authorization)
   * - Suppliers can only access their own data (filtered by invitation)
   * 
   * Operations:
   * - READ: Retrieve draft or submitted data
   * - CREATE: Initial data submission
   * - UPDATE: Update draft (only if status = DRAFT)
   * - DELETE: Not allowed
   */
  entity MyOnboardingData as projection on db.SupplierOnboardingData {
    *,
    attachments
  } excluding {
    // Hide internal fields from external suppliers
    reviewedBy,
    reviewNotes,
    approvedBy,
    s4BusinessPartnerId,
    s4VendorId,
    s4SyncedAt,
    s4SyncStatus,
    s4SyncErrors
  };
  
  /**
   * MyAttachments - Supplier's uploaded documents
   * 
   * Suppliers can:
   * - List their own attachments
   * - Upload new files (via uploadAttachment action)
   * - Delete attachments (before submission)
   */
  entity MyAttachments as projection on db.AttachmentMetadata {
    *
  } excluding {
    // Hide storage internals
    storageKey,
    virusScanStatus,
    virusScanDate,
    isArchived,
    archivedAt
  };
  
  //===========================================================================
  // ACTIONS (Primary supplier operations)
  //===========================================================================
  
  /**
   * submitSupplierData - Complete onboarding form submission
   * 
   * Flow:
   * 1. Validate JWT token from request header
   * 2. Check invitation state (must be VALIDATED or OPENED)
   * 3. Validate all required fields (company name, tax ID, bank details, etc.)
   * 4. Create or update SupplierOnboardingData record
   * 5. Update onboardingStatus to SUBMITTED
   * 6. Update invitation tokenState to CONSUMED
   * 7. Create Business Partner in S/4HANA (async)
   * 8. Create Supplier in S/4HANA (async)
   * 9. Link attachments to S/4HANA record
   * 10. Audit log the submission
   * 
   * Authorization: Valid JWT token required
   * Validation:
   * - Company legal name (required)
   * - Tax ID or VAT number (required)
   * - Bank details (IBAN format validation)
   * - At least 1 contact person
   * - At least 1 attachment
   * 
   * Returns:
   * - Success: Confirmation with reference number
   * - Error: Detailed validation errors
   * 
   * Audit: Logs DATA_SUBMITTED event
   */
  action submitSupplierData(
    // Company Information
    companyLegalName      : String not null,
    taxId                 : String,
    vatNumber             : String,
    dunsNumber            : String,
    businessRegistration  : String,
    
    // Address
    street                : String,
    city                  : String,
    region                : String,
    postalCode            : String,
    country_code          : String not null,
    
    // Primary Contact
    primaryContactName    : String not null,
    primaryContactEmail   : String not null,
    primaryContactPhone   : String,
    
    // Banking Information
    bankName              : String,
    bankAccountNumber     : String,
    bankRoutingNumber     : String,
    swiftCode             : String,
    iban                  : String,
    
    // Business Details
    yearEstablished       : Integer,
    numberOfEmployees     : Integer,
    annualRevenue         : Decimal(15,2),
    currency_code         : String,
    websiteUrl            : String,
    businessDescription   : String,
    
    // Classification
    industryCode          : String,
    commodities           : String,
    preferredPaymentTerms : String,
    preferredCurrency_code: String
    
  ) returns {
    success             : Boolean;
    referenceNumber     : String;
    onboardingId        : UUID;
    s4BusinessPartnerId : String;
    s4VendorId          : String;
    message             : String;
    errors              : array of {
      field   : String;
      message : String;
    };
  };
  
  /**
   * saveDraft - Save partial form data without submission
   * 
   * Flow:
   * 1. Validate token
   * 2. Create or update SupplierOnboardingData with status = DRAFT
   * 3. Store partial data (no validation required)
   * 4. Allow supplier to continue later
   * 
   * Authorization: Valid JWT token required
   * Use Case: Supplier needs time to gather documents, can save progress
   * 
   * Audit: Logs ONBOARDING_STARTED event (first save only)
   */
  action saveDraft(
    formData : String  // JSON string of partial form data
  ) returns {
    success       : Boolean;
    onboardingId  : UUID;
    savedAt       : Timestamp;
  };
  
  /**
   * uploadAttachment - Upload document to Object Store
   * 
   * Flow:
   * 1. Validate token
   * 2. Validate file metadata (size < 5MB, allowed types)
   * 3. Generate presigned S3 PUT URL (15 min expiry)
   * 4. Return presigned URL to frontend
   * 5. Frontend uploads directly to S3
   * 6. Frontend calls confirmUpload to save metadata
   * 
   * Authorization: Valid JWT token required
   * Validation:
   * - File size: Max 5MB
   * - File types: PDF, JPG, PNG, DOCX
   * - Max 10 files per invitation
   * 
   * Two-phase process:
   * 1. uploadAttachment → presigned URL
   * 2. confirmUpload → save metadata
   * 
   * Audit: Logs DOCUMENT_UPLOADED event
   */
  action uploadAttachment(
    fileName        : String not null,
    fileSize        : Integer not null,
    mimeType        : String not null,
    attachmentType  : String not null,
    description     : String
  ) returns {
    presignedUrl  : String;
    storageKey    : String;
    expiresAt     : Timestamp;
    attachmentId  : UUID;
  };
  
  /**
   * confirmUpload - Confirm successful S3 upload and save metadata
   * 
   * Flow:
   * 1. Validate token
   * 2. Verify file exists in S3 bucket
   * 3. Create AttachmentMetadata record
   * 4. Link to SupplierOnboardingData
   * 5. Update audit log
   * 
   * Authorization: Valid JWT token required
   */
  action confirmUpload(
    attachmentId  : UUID not null,
    storageKey    : String not null
  ) returns {
    success   : Boolean;
    message   : String;
  };
  
  /**
   * deleteAttachment - Remove uploaded document
   * 
   * Flow:
   * 1. Validate token
   * 2. Check onboarding status (can only delete if DRAFT)
   * 3. Delete from S3
   * 4. Delete metadata record
   * 
   * Authorization: Valid JWT token required
   * Restriction: Only allowed before final submission
   */
  action deleteAttachment(
    attachmentId : UUID not null
  ) returns {
    success : Boolean;
    message : String;
  };
  
  //===========================================================================
  // FUNCTIONS (Read-only queries for suppliers)
  //===========================================================================
  
  /**
   * getMyData - Retrieve supplier's own onboarding data
   * 
   * Flow:
   * 1. Validate token
   * 2. Query SupplierOnboardingData by invitation ID
   * 3. Return data with attachments
   * 
   * Authorization: Valid JWT token required
   * Use Case: Supplier reviews entered data before submission
   */
  function getMyData() returns {
    onboardingId        : UUID;
    onboardingStatus    : String;
    companyLegalName    : String;
    email               : String;
    submittedAt         : Timestamp;
    formData            : String;  // JSON representation
    attachmentCount     : Integer;
    attachments         : array of {
      attachmentId  : UUID;
      fileName      : String;
      attachmentType: String;
      fileSize      : Integer;
      uploadedAt    : Timestamp;
    };
  };
  
  /**
   * generateDownloadUrl - Get presigned URL for attachment download
   * 
   * Flow:
   * 1. Validate token
   * 2. Verify attachment belongs to supplier's invitation
   * 3. Generate presigned S3 GET URL (5 min expiry)
   * 4. Return URL for frontend download
   * 
   * Authorization: Valid JWT token required
   * Security: Suppliers can only download their own attachments
   */
  function generateDownloadUrl(
    attachmentId : UUID not null
  ) returns {
    presignedUrl  : String;
    expiresAt     : Timestamp;
    fileName      : String;
  };
  
  /**
   * getInvitationInfo - Retrieve basic invitation details
   * 
   * Flow:
   * 1. Validate token
   * 2. Return invitation metadata (email, company, expiry)
   * 
   * Authorization: Valid JWT token required
   * Use Case: Display supplier info in UI header
   */
  function getInvitationInfo() returns {
    invitationId  : UUID;
    email         : String;
    companyName   : String;
    contactName   : String;
    expiresAt     : Timestamp;
    tokenState    : String;
  };
}
