using { supplier.onboarding as db } from '../db/schema';

/**
 * Supplier Service - External suppliers (token-authenticated)
 * Handles supplier data submission and file uploads
 */
service SupplierService @(requires: 'none') {
  
  // Suppliers - external users submit their data
  entity Suppliers as projection on db.Suppliers {
    *
  };
  
  // Attachments - file upload metadata
  entity Attachments as projection on db.Attachments;
  
  // Custom action to submit supplier data with token (unbound - service level)
  action submitData(
    token: String(500),
    companyData: {
      companyName: String;
      legalForm: String;
      taxID: String;
      vatID: String;
      street: String;
      city: String;
      postalCode: String;
      country: String;
      email: String;
      phone: String;
      website: String;
      bankName: String;
      iban: String;
      swiftCode: String;
      commodityCodes: String;
      certifications: String;
    }
  ) returns {
    success: Boolean;
    supplierID: String;
    message: String;
  };
  
  // Request presigned URL for file upload (unbound - service level)
  action requestUploadURL(
    token: String(500),
    fileName: String(255),
    fileType: String(50),
    fileSize: Integer
  ) returns {
    presignedUrl: String;
    expiresIn: Integer;
    s3Key: String;
  };
}
