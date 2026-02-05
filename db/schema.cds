namespace supplier.onboarding;

using { managed, cuid } from '@sap/cds/common';

/**
 * Invitation entity - stores invitation records with secure tokens
 * Each invitation is single-use and time-limited
 */
entity Invitations : cuid, managed {
  supplierEmail     : String(255) @mandatory @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  supplierName      : String(255) @mandatory;
  token             : String(500) @mandatory @readonly;  // JWT token - read-only after creation
  tokenHash         : String(64) @readonly;              // SHA-256 hash for quick lookup
  expiresAt         : DateTime @mandatory @readonly;
  isUsed            : Boolean default false @readonly;   // Single-use enforcement - system managed
  usedAt            : DateTime @readonly;
  status            : String(20) default 'PENDING' @assert.range: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'];
  createdByUser     : String(255);             // Internal user who created invitation
  
  // Navigation to supplier data
  supplier          : Association to Suppliers;
}

/**
 * Suppliers entity - stores supplier master data
 * Maps to S/4HANA Business Partner fields
 */
entity Suppliers : cuid, managed {
  // Business Partner Basic Data
  businessPartnerID : String(10) @readonly;    // S/4HANA BP ID (after creation) - system managed
  companyName       : String(255) @mandatory;
  legalForm         : String(50);
  taxID             : String(50) @assert.format: '^[A-Z0-9-]+$';
  vatID             : String(50) @assert.format: '^[A-Z]{2}[A-Z0-9]+$';
  
  // Address Information
  street            : String(255) @mandatory;
  city              : String(100) @mandatory;
  postalCode        : String(10) @mandatory;
  country           : String(3) @mandatory @assert.format: '^[A-Z]{3}$';  // ISO 3166-1 alpha-3
  
  // Contact Information
  email             : String(255) @mandatory @assert.format: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  phone             : String(50) @mandatory @assert.format: '^\+?[0-9\s\-\(\)]+$';
  website           : String(255) @assert.format: '^https?://.*';
  
  // Payment Information
  bankName          : String(255) @mandatory;
  iban              : String(34) @mandatory @assert.format: '^[A-Z]{2}[0-9]{2}[A-Z0-9]+$';
  swiftCode         : String(11) @assert.format: '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$';
  
  // Additional Data
  commodityCodes    : String(500);             // Comma-separated list
  certifications    : String(500);             // Comma-separated list
  
  // Status & Sync
  s4hanaStatus      : String(20) default 'PENDING' @readonly @assert.range: ['PENDING', 'SYNCED', 'FAILED'];
  s4hanaSyncedAt    : DateTime @readonly;
  s4hanaError       : String(1000) @readonly;
  
  // Navigation
  invitation        : Association to Invitations;
  attachments       : Composition of many Attachments on attachments.supplier = $self;
}

/**
 * Attachments entity - stores metadata for uploaded files
 * Actual files are stored in Object Store
 */
entity Attachments : cuid, managed {
  supplier          : Association to Suppliers @mandatory;
  fileName          : String(255) @mandatory;
  fileType          : String(50) @mandatory;   // MIME type
  fileSize          : Integer @mandatory @assert.range: [1, 10485760];  // Max 10MB
  s3Key             : String(500) @readonly;   // Object Store key/path - system managed
  s3Bucket          : String(255) @readonly;   // Bucket name - system managed
  uploadedAt        : DateTime @readonly;
  uploadStatus      : String(20) default 'PENDING' @assert.range: ['PENDING', 'UPLOADING', 'COMPLETED', 'FAILED'];
  presignedUrl      : String(1000) @readonly;  // Temporary, not persisted long-term
  presignedUrlExpiresAt : DateTime @readonly;
}
