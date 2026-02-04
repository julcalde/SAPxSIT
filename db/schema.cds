namespace supplier.onboarding;

using { managed, cuid } from '@sap/cds/common';

/**
 * Invitation entity - stores invitation records with secure tokens
 * Each invitation is single-use and time-limited
 */
entity Invitations : cuid, managed {
  supplierEmail     : String(255) @mandatory;
  supplierName      : String(255);
  token             : String(500) @mandatory;  // JWT token
  tokenHash         : String(64);              // SHA-256 hash for quick lookup
  expiresAt         : DateTime @mandatory;
  isUsed            : Boolean default false;   // Single-use enforcement
  usedAt            : DateTime;
  status            : String(20) default 'PENDING'; // PENDING, IN_PROGRESS, COMPLETED, EXPIRED
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
  businessPartnerID : String(10);              // S/4HANA BP ID (after creation)
  companyName       : String(255) @mandatory;
  legalForm         : String(50);
  taxID             : String(50);
  vatID             : String(50);
  
  // Address Information
  street            : String(255);
  city              : String(100);
  postalCode        : String(10);
  country           : String(3);               // ISO 3166-1 alpha-3
  
  // Contact Information
  email             : String(255) @mandatory;
  phone             : String(50);
  website           : String(255);
  
  // Payment Information
  bankName          : String(255);
  iban              : String(34);
  swiftCode         : String(11);
  
  // Additional Data
  commodityCodes    : String(500);             // Comma-separated list
  certifications    : String(500);             // Comma-separated list
  
  // Status & Sync
  s4hanaStatus      : String(20);              // SYNCED, PENDING, FAILED
  s4hanaSyncedAt    : DateTime;
  s4hanaError       : String(1000);
  
  // Navigation
  invitation        : Association to Invitations;
  attachments       : Composition of many Attachments on attachments.supplier = $self;
}

/**
 * Attachments entity - stores metadata for uploaded files
 * Actual files are stored in Object Store
 */
entity Attachments : cuid, managed {
  supplier          : Association to Suppliers;
  fileName          : String(255) @mandatory;
  fileType          : String(50);              // MIME type
  fileSize          : Integer;                 // Size in bytes
  s3Key             : String(500);             // Object Store key/path
  s3Bucket          : String(255);             // Bucket name
  uploadedAt        : DateTime;
  presignedUrl      : String(1000);            // Temporary, not persisted long-term
  presignedUrlExpiresAt : DateTime;
}
