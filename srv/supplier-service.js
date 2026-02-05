/**
 * Supplier Service Implementation
 * Handles supplier data submission with token validation
 */
module.exports = async function() {
  const cds = require('@sap/cds');
  const { Invitations, Suppliers, Attachments } = cds.entities('supplier.onboarding');
  
  // CREATE: Submit supplier data
  this.on('submitData', async (req) => {
    const { token, companyData } = req.data;
    
    console.log('[SupplierService] Received supplier data submission');
    
    // Validate token (mock - will use JWT in Step 6)
    const invitation = await SELECT.one.from(Invitations).where({ token });
    
    if (!invitation) {
      return req.error(401, 'Invalid or expired invitation token');
    }
    
    if (invitation.isUsed) {
      return req.error(403, 'Invitation token has already been used');
    }
    
    if (new Date(invitation.expiresAt) < new Date()) {
      await UPDATE(Invitations, invitation.ID).set({ status: 'EXPIRED' });
      return req.error(401, 'Invitation token has expired');
    }
    
    // Create supplier record
    const result = await INSERT.into(Suppliers).entries({
      companyName: companyData.companyName,
      legalForm: companyData.legalForm,
      taxID: companyData.taxID,
      vatID: companyData.vatID,
      street: companyData.street,
      city: companyData.city,
      postalCode: companyData.postalCode,
      country: companyData.country,
      email: companyData.email,
      phone: companyData.phone,
      website: companyData.website,
      bankName: companyData.bankName,
      iban: companyData.iban,
      swiftCode: companyData.swiftCode,
      commodityCodes: companyData.commodityCodes,
      certifications: companyData.certifications,
      s4hanaStatus: 'PENDING',
      invitation_ID: invitation.ID
    });
    
    // Retrieve the created supplier with ID
    const supplier = await SELECT.one.from(Suppliers).where({ invitation_ID: invitation.ID });
    
    // Mark invitation as used
    await UPDATE(Invitations, invitation.ID).set({
      isUsed: true,
      usedAt: new Date().toISOString(),
      status: 'COMPLETED',
      supplier_ID: supplier.ID
    });
    
    console.log(`[SupplierService] Created supplier ID: ${supplier.ID}`);
    
    return {
      success: true,
      supplierID: supplier.ID,
      message: 'Supplier data submitted successfully'
    };
  });
  
  // READ: Suppliers (external access via token)
  this.before('READ', 'Suppliers', async (req) => {
    console.log('[SupplierService] Reading supplier data');
    // TODO: Add token-based filtering in Step 6
  });
  
  // UPDATE: Prevent updates to readonly fields
  this.before('UPDATE', 'Suppliers', async (req) => {
    const readonlyFields = ['businessPartnerID', 's4hanaStatus', 's4hanaSyncedAt', 's4hanaError'];
    
    for (const field of readonlyFields) {
      if (req.data[field] !== undefined) {
        req.error(403, `Field '${field}' is read-only and cannot be updated`);
      }
    }
  });
  
  // CREATE: Request presigned URL for file upload
  this.on('requestUploadURL', async (req) => {
    const { token, fileName, fileType, fileSize } = req.data;
    
    console.log(`[SupplierService] Requesting upload URL for ${fileName}`);
    
    // Validate token (mock - will use JWT in Step 6)
    const invitation = await SELECT.one.from(Invitations).where({ token });
    
    if (!invitation) {
      return req.error(401, 'Invalid or expired invitation token');
    }
    
    // Validate file size (max 10MB)
    if (fileSize > 10485760) {
      return req.error(400, 'File size exceeds maximum limit of 10MB');
    }
    
    // Mock presigned URL (will integrate with Object Store in Step 12)
    const mockS3Key = `uploads/${invitation.ID}/${Date.now()}-${fileName}`;
    const mockPresignedUrl = `https://mock-s3.example.com/upload?key=${mockS3Key}&signature=MOCK`;
    
    // Create attachment record
    await INSERT.into(Attachments).entries({
      supplier_ID: invitation.supplier_ID,
      fileName,
      fileType,
      fileSize,
      s3Key: mockS3Key,
      s3Bucket: 'supplier-onboarding-bucket',
      uploadStatus: 'PENDING',
      presignedUrl: mockPresignedUrl,
      presignedUrlExpiresAt: new Date(Date.now() + 3600000) // 1 hour
    });
    
    return {
      presignedUrl: mockPresignedUrl,
      expiresIn: 3600,
      s3Key: mockS3Key
    };
  });
  
  // Log service initialization
  console.log('[SupplierService] Service initialized successfully');
};
