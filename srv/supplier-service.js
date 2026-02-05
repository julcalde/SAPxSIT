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
    
    // Validate input
    if (!token) {
      return req.error(400, 'Token is required');
    }
    
    if (!companyData) {
      return req.error(400, 'Company data is required');
    }
    
    // Validate required fields
    const requiredFields = ['companyName', 'taxID', 'vatID', 'street', 'city', 'postalCode', 'country', 'email', 'phone', 'bankName', 'iban'];
    for (const field of requiredFields) {
      if (!companyData[field] || companyData[field].toString().trim() === '') {
        return req.error(400, `Field '${field}' is required`);
      }
    }
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(companyData.email)) {
      return req.error(400, 'Invalid email format');
    }
    
    // Validate country code (ISO 3166-1 alpha-3)
    if (companyData.country.length !== 3 || !/^[A-Z]{3}$/.test(companyData.country)) {
      return req.error(400, 'Country code must be 3 uppercase letters (ISO 3166-1 alpha-3)');
    }
    
    // Validate IBAN format (basic check)
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(companyData.iban)) {
      return req.error(400, 'Invalid IBAN format (must start with 2 letters, 2 digits, followed by alphanumeric)');
    }
    
    try {
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
        companyName: companyData.companyName.trim(),
        legalForm: companyData.legalForm?.trim() || null,
        taxID: companyData.taxID.trim().toUpperCase(),
        vatID: companyData.vatID.trim().toUpperCase(),
        street: companyData.street.trim(),
        city: companyData.city.trim(),
        postalCode: companyData.postalCode.trim(),
        country: companyData.country.trim().toUpperCase(),
        email: companyData.email.trim().toLowerCase(),
        phone: companyData.phone.trim(),
        website: companyData.website?.trim() || null,
        bankName: companyData.bankName.trim(),
        iban: companyData.iban.trim().toUpperCase().replace(/\s/g, ''),
        swiftCode: companyData.swiftCode?.trim().toUpperCase() || null,
        commodityCodes: companyData.commodityCodes?.trim() || null,
        certifications: companyData.certifications?.trim() || null,
        s4hanaStatus: 'PENDING',
        invitation_ID: invitation.ID
      });
      
      // Retrieve the created supplier with ID
      const supplier = await SELECT.one.from(Suppliers).where({ invitation_ID: invitation.ID });
      
      if (!supplier) {
        return req.error(500, 'Failed to create supplier record');
      }
      
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
    } catch (error) {
      console.error('[SupplierService] Error submitting supplier data:', error);
      return req.error(500, `Failed to submit supplier data: ${error.message}`);
    }
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
    
    // Validate inputs
    if (!token || !fileName || !fileType || !fileSize) {
      return req.error(400, 'token, fileName, fileType, and fileSize are required');
    }
    
    // Validate file size (max 10MB)
    if (fileSize > 10485760) {
      return req.error(400, 'File size exceeds maximum limit of 10MB');
    }
    
    if (fileSize < 1) {
      return req.error(400, 'File size must be at least 1 byte');
    }
    
    // Validate file type (whitelist common business documents)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 
                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (!allowedTypes.includes(fileType)) {
      return req.error(400, `File type '${fileType}' is not allowed. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX`);
    }
    
    try {
      // Validate token (mock - will use JWT in Step 6)
      const invitation = await SELECT.one.from(Invitations).where({ token });
      
      if (!invitation) {
        return req.error(401, 'Invalid or expired invitation token');
      }
      
      // Mock presigned URL (will integrate with Object Store in Step 12)
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const mockS3Key = `uploads/${invitation.ID}/${Date.now()}-${sanitizedFileName}`;
      const mockPresignedUrl = `https://mock-s3.example.com/upload?key=${mockS3Key}&signature=MOCK`;
      
      // Create attachment record
      await INSERT.into(Attachments).entries({
        supplier_ID: invitation.supplier_ID,
        fileName: sanitizedFileName,
        fileType,
        fileSize,
        s3Key: mockS3Key,
        s3Bucket: 'supplier-onboarding-bucket',
        uploadStatus: 'PENDING',
        presignedUrl: mockPresignedUrl,
        presignedUrlExpiresAt: new Date(Date.now() + 3600000) // 1 hour
      });
      
      console.log(`[SupplierService] Generated presigned URL for ${sanitizedFileName}`);
      
      return {
        presignedUrl: mockPresignedUrl,
        expiresIn: 3600,
        s3Key: mockS3Key
      };
    } catch (error) {
      console.error('[SupplierService] Error generating presigned URL:', error);
      return req.error(500, `Failed to generate upload URL: ${error.message}`);
    }
  });
  
  // Log service initialization
  console.log('[SupplierService] Service initialized successfully');
};
