/**
 * Supplier Service Handlers
 * 
 * Implements CAP service handlers for supplier self-onboarding operations.
 * This service is accessed by external suppliers using JWT magic links.
 * 
 * Key Features:
 * - Token-based authentication (no XSUAA required for suppliers)
 * - Draft data persistence (save progress before submission)
 * - Complete form submission with validation
 * - Attachment upload/download via Object Store
 * - S/4HANA Business Partner creation (future integration)
 * 
 * Security:
 * - All operations validate JWT token from request headers
 * - Single-use enforcement (invitation consumed after submission)
 * - Rate limiting per token
 * - Input validation (email, tax ID, IBAN formats)
 * 
 * @module srv/supplier-service
 */

const cds = require('@sap/cds');
const { validateToken } = require('./lib/token-validator');
const { 
  validateEmail, 
  validateTaxId, 
  validateIBAN, 
  validatePhoneNumber,
  validateUrl 
} = require('./lib/validators');

/**
 * Configuration from environment variables
 */
const CONFIG = {
  maxAttachments: parseInt(process.env.MAX_ATTACHMENTS_PER_SUPPLIER) || 10,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB) || 5,
  allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(','),
  xsuaaPublicKey: process.env.XSUAA_PUBLIC_KEY || null,
  xsuaaPrivateKey: process.env.XSUAA_PRIVATE_KEY || null,
};

/**
 * Main service handler registration
 */
module.exports = async (srv) => {
  
  const { SupplierOnboardingData, AttachmentMetadata, SupplierInvitations, AuditLogs } = srv.entities;
  const db = await cds.connect.to('db');
  
  //===========================================================================
  // MIDDLEWARE: Token Validation
  //===========================================================================
  
  /**
   * Before handler - Extract and validate JWT token for all operations
   * 
   * This middleware runs before all actions/functions in this service.
   * Extracts token from Authorization header, validates it, and stores
   * invitation context in req for downstream handlers.
   */
  srv.before('*', async (req) => {
    // Extract token from Authorization header
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    
    if (!authHeader) {
      req.reject(401, 'Missing authentication token', 'MISSING_TOKEN');
    }
    
    // Extract bearer token
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token) {
      req.reject(401, 'Invalid authorization header format', 'INVALID_AUTH_HEADER');
    }
    
    try {
      // Validate token using token-validator from Step 7
      const validationResult = await validateToken(token, {
        publicKey: CONFIG.xsuaaPublicKey,
        database: db,
        ipAddress: req.http?.req?.ip || 'unknown',
        maxValidationAttempts: 20, // Higher limit for suppliers actively filling forms
      });
      
      if (!validationResult.valid) {
        req.reject(401, validationResult.errorMessage || 'Token validation failed', validationResult.errorCode || 'INVALID_TOKEN');
      }
      
      // Store invitation context in request for handlers
      req.invitation = {
        invitationId: validationResult.invitationId,
        email: validationResult.email,
        companyName: validationResult.companyName,
        contactName: validationResult.contactName,
        tokenState: validationResult.tokenState
      };
      
    } catch (error) {
      console.error('Token validation error:', error);
      req.reject(401, 'Authentication failed', 'AUTH_FAILED');
    }
  });
  
  //===========================================================================
  // ACTION: submitSupplierData
  //===========================================================================
  
  /**
   * Submit complete supplier onboarding data
   * 
   * @param {Object} data - Form data with company, contact, bank details
   * @returns {Object} - Success status, reference number, S/4HANA IDs
   * 
   * Note: Most validations now handled by CDS declarative annotations (@assert)
   * Only business logic validations remain here
   */
  srv.on('submitSupplierData', async (req) => {
    const { data } = req;
    const { invitationId, email } = req.invitation;
    
    try {
      // Step 1: Business logic validations (CDS handles format validations)
      const validationErrors = [];
      
      // Business rule: Tax ID or VAT number required (at least one)
      if (!data.taxId && !data.vatNumber) {
        validationErrors.push({ 
          field: 'taxId', 
          message: 'Either Tax ID or VAT number is required' 
        });
      }
      
      // Business rule: At least one attachment required
      const attachments = await db.run(
        SELECT.from(AttachmentMetadata)
          .where({ invitation_ID: invitationId, isDeleted: false })
      );
      
      if (!attachments || attachments.length === 0) {
        validationErrors.push({ 
          field: 'attachments', 
          message: 'At least one supporting document is required' 
        });
      }
      
      // Return business validation errors if any
      // (CDS format validations will have failed earlier via @assert)
      if (validationErrors.length > 0) {
        return {
          success: false,
          referenceNumber: null,
          onboardingId: null,
          s4BusinessPartnerId: null,
          s4VendorId: null,
          message: 'Validation failed. Please correct the errors and try again.',
          errors: validationErrors
        };
      }
      
      // Step 2: Check invitation state (must not be CONSUMED)
      const invitation = await db.run(
        SELECT.one.from(SupplierInvitations)
          .where({ ID: invitationId })
      );
      
      if (!invitation) {
        req.reject(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
      }
      
      if (invitation.tokenState === 'CONSUMED') {
        req.reject(400, 'This invitation has already been used', 'INVITATION_CONSUMED');
      }
      
      if (invitation.tokenState === 'REVOKED') {
        req.reject(400, 'This invitation has been revoked', 'INVITATION_REVOKED');
      }
      
      // Step 3: Create or update SupplierOnboardingData
      const existingData = await db.run(
        SELECT.one.from(SupplierOnboardingData)
          .where({ invitation_ID: invitationId })
      );
      
      const referenceNumber = `SUP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
      const now = new Date();
      
      let onboardingId;
      
      if (existingData) {
        // Update existing draft
        onboardingId = existingData.ID;
        
        await db.run(
          UPDATE(SupplierOnboardingData)
            .set({
              // Company Information
              companyLegalName: data.companyLegalName,
              taxId: data.taxId,
              vatNumber: data.vatNumber,
              dunsNumber: data.dunsNumber,
              businessRegistration: data.businessRegistration,
              
              // Address
              street: data.street,
              city: data.city,
              region: data.region,
              postalCode: data.postalCode,
              country_code: data.country_code,
              
              // Primary Contact
              primaryContactName: data.primaryContactName,
              primaryContactEmail: data.primaryContactEmail,
              primaryContactPhone: data.primaryContactPhone,
              
              // Banking
              bankName: data.bankName,
              bankAccountNumber: data.bankAccountNumber,
              bankRoutingNumber: data.bankRoutingNumber,
              swiftCode: data.swiftCode,
              iban: data.iban,
              
              // Business Details
              yearEstablished: data.yearEstablished,
              numberOfEmployees: data.numberOfEmployees,
              annualRevenue: data.annualRevenue,
              currency_code: data.currency_code,
              websiteUrl: data.websiteUrl,
              businessDescription: data.businessDescription,
              
              // Classification
              industryCode: data.industryCode,
              commodities: data.commodities,
              preferredPaymentTerms: data.preferredPaymentTerms,
              preferredCurrency_code: data.preferredCurrency_code,
              
              // Status tracking
              onboardingStatus: 'SUBMITTED',
              referenceNumber: referenceNumber,
              submittedAt: now,
              modifiedAt: now
            })
            .where({ ID: onboardingId })
        );
        
      } else {
        // Create new record
        const newRecord = {
          ID: cds.utils.uuid(),
          invitation_ID: invitationId,
          email: email,
          
          // Company Information
          companyLegalName: data.companyLegalName,
          taxId: data.taxId,
          vatNumber: data.vatNumber,
          dunsNumber: data.dunsNumber,
          businessRegistration: data.businessRegistration,
          
          // Address
          street: data.street,
          city: data.city,
          region: data.region,
          postalCode: data.postalCode,
          country_code: data.country_code,
          
          // Primary Contact
          primaryContactName: data.primaryContactName,
          primaryContactEmail: data.primaryContactEmail,
          primaryContactPhone: data.primaryContactPhone,
          
          // Banking
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          bankRoutingNumber: data.bankRoutingNumber,
          swiftCode: data.swiftCode,
          iban: data.iban,
          
          // Business Details
          yearEstablished: data.yearEstablished,
          numberOfEmployees: data.numberOfEmployees,
          annualRevenue: data.annualRevenue,
          currency_code: data.currency_code,
          websiteUrl: data.websiteUrl,
          businessDescription: data.businessDescription,
          
          // Classification
          industryCode: data.industryCode,
          commodities: data.commodities,
          preferredPaymentTerms: data.preferredPaymentTerms,
          preferredCurrency_code: data.preferredCurrency_code,
          
          // Status tracking
          onboardingStatus: 'SUBMITTED',
          referenceNumber: referenceNumber,
          submittedAt: now,
          createdAt: now,
          modifiedAt: now
        };
        
        await db.run(INSERT.into(SupplierOnboardingData).entries(newRecord));
        onboardingId = newRecord.ID;
      }
      
      // Step 4: Update invitation to CONSUMED state
      await db.run(
        UPDATE(SupplierInvitations)
          .set({
            tokenState: 'CONSUMED',
            consumedAt: now
          })
          .where({ ID: invitationId })
      );
      
      // Step 5: Link attachments to onboarding data
      await db.run(
        UPDATE(AttachmentMetadata)
          .set({ onboardingData_ID: onboardingId })
          .where({ invitation_ID: invitationId, isDeleted: false })
      );
      
      // Step 6: Create audit log
      await logAuditEvent(
        'DATA_SUBMITTED',
        invitationId,
        null,
        {
          onboardingId: onboardingId,
          referenceNumber: referenceNumber,
          companyName: data.companyLegalName,
          attachmentCount: attachments.length
        },
        req
      );
      
      // Step 7: Return success response
      // Note: S/4HANA integration will be added in Step 11
      return {
        success: true,
        referenceNumber: referenceNumber,
        onboardingId: onboardingId,
        s4BusinessPartnerId: null, // Will be populated in Step 11
        s4VendorId: null,          // Will be populated in Step 11
        message: `Onboarding data submitted successfully. Reference number: ${referenceNumber}`,
        errors: []
      };
      
    } catch (error) {
      console.error('submitSupplierData error:', error);
      
      // Log failure audit event
      await logAuditEvent(
        'DATA_SUBMISSION_FAILED',
        invitationId,
        null,
        { error: error.message },
        req
      );
      
      req.reject(500, 'Failed to submit supplier data. Please try again.', 'SUBMISSION_FAILED');
    }
  });
  
  //===========================================================================
  // ACTION: saveDraft
  //===========================================================================
  
  /**
   * Save partial form data as draft
   * 
   * @param {Object} formData - JSON string of partial form data
   * @returns {Object} - Success status, onboarding ID, timestamp
   */
  srv.on('saveDraft', async (req) => {
    const { formData } = req.data;
    const { invitationId, email } = req.invitation;
    
    try {
      // Check invitation state
      const invitation = await db.run(
        SELECT.one.from(SupplierInvitations)
          .where({ ID: invitationId })
      );
      
      if (!invitation) {
        req.reject(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
      }
      
      if (invitation.tokenState === 'CONSUMED') {
        req.reject(400, 'Cannot save draft - invitation already consumed', 'INVITATION_CONSUMED');
      }
      
      if (invitation.tokenState === 'REVOKED') {
        req.reject(400, 'Cannot save draft - invitation revoked', 'INVITATION_REVOKED');
      }
      
      // Parse form data (validate it's valid JSON)
      let parsedData;
      try {
        parsedData = typeof formData === 'string' ? JSON.parse(formData) : formData;
      } catch (e) {
        req.reject(400, 'Invalid form data format - must be valid JSON', 'INVALID_JSON');
      }
      
      const now = new Date();
      
      // Check if draft already exists
      const existingDraft = await db.run(
        SELECT.one.from(SupplierOnboardingData)
          .where({ invitation_ID: invitationId })
      );
      
      let onboardingId;
      let isFirstSave = false;
      
      if (existingDraft) {
        // Update existing draft
        onboardingId = existingDraft.ID;
        
        await db.run(
          UPDATE(SupplierOnboardingData)
            .set({
              draftData: JSON.stringify(parsedData),
              onboardingStatus: 'DRAFT',
              modifiedAt: now
            })
            .where({ ID: onboardingId })
        );
        
      } else {
        // Create new draft
        isFirstSave = true;
        onboardingId = cds.utils.uuid();
        
        await db.run(
          INSERT.into(SupplierOnboardingData).entries({
            ID: onboardingId,
            invitation_ID: invitationId,
            email: email,
            draftData: JSON.stringify(parsedData),
            onboardingStatus: 'DRAFT',
            createdAt: now,
            modifiedAt: now
          })
        );
      }
      
      // Update invitation state to OPENED (first time only)
      if (isFirstSave && invitation.tokenState === 'VALIDATED') {
        await db.run(
          UPDATE(SupplierInvitations)
            .set({ tokenState: 'OPENED' })
            .where({ ID: invitationId })
        );
      }
      
      // Create audit log (only for first save)
      if (isFirstSave) {
        await logAuditEvent(
          'ONBOARDING_STARTED',
          invitationId,
          null,
          { onboardingId: onboardingId },
          req
        );
      }
      
      return {
        success: true,
        onboardingId: onboardingId,
        savedAt: now
      };
      
    } catch (error) {
      console.error('saveDraft error:', error);
      req.reject(500, 'Failed to save draft data', 'DRAFT_SAVE_FAILED');
    }
  });
  
  //===========================================================================
  // ACTION: uploadAttachment (Placeholder - Object Store in Step 14)
  //===========================================================================
  
  /**
   * Generate presigned URL for attachment upload
   * 
   * Note: Full implementation in Step 14 (Object Store integration)
   * For now, returns placeholder response
   */
  srv.on('uploadAttachment', async (req) => {
    const { fileName, fileSize, mimeType, attachmentType, description } = req.data;
    const { invitationId } = req.invitation;
    
    try {
      // Validate file size
      const fileSizeMB = fileSize / (1024 * 1024);
      if (fileSizeMB > CONFIG.maxFileSize) {
        req.reject(400, `File size exceeds maximum allowed (${CONFIG.maxFileSize}MB)`, 'FILE_TOO_LARGE');
      }
      
      // Validate MIME type
      if (!CONFIG.allowedMimeTypes.includes(mimeType)) {
        req.reject(400, `File type not allowed. Allowed types: ${CONFIG.allowedMimeTypes.join(', ')}`, 'INVALID_FILE_TYPE');
      }
      
      // Check attachment count
      const existingAttachments = await db.run(
        SELECT.from(AttachmentMetadata)
          .where({ invitation_ID: invitationId, isDeleted: false })
      );
      
      if (existingAttachments.length >= CONFIG.maxAttachments) {
        req.reject(400, `Maximum number of attachments (${CONFIG.maxAttachments}) reached`, 'MAX_ATTACHMENTS_REACHED');
      }
      
      // Generate attachment ID and storage key
      const attachmentId = cds.utils.uuid();
      const storageKey = `${invitationId}/${attachmentId}-${fileName}`;
      
      // Create placeholder attachment metadata
      const now = new Date();
      await db.run(
        INSERT.into(AttachmentMetadata).entries({
          ID: attachmentId,
          invitation_ID: invitationId,
          fileName: fileName,
          fileSize: fileSize,
          mimeType: mimeType,
          attachmentType: attachmentType,
          description: description,
          storageKey: storageKey,
          uploadStatus: 'PENDING',
          uploadedAt: now,
          createdAt: now,
          isDeleted: false
        })
      );
      
      // TODO: Step 14 - Generate real presigned S3 URL
      const presignedUrl = `https://placeholder-objectstore.s3.amazonaws.com/${storageKey}?X-Amz-Expires=900`;
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      return {
        presignedUrl: presignedUrl,
        storageKey: storageKey,
        expiresAt: expiresAt,
        attachmentId: attachmentId
      };
      
    } catch (error) {
      console.error('uploadAttachment error:', error);
      req.reject(500, 'Failed to generate upload URL', 'UPLOAD_URL_FAILED');
    }
  });
  
  //===========================================================================
  // ACTION: confirmUpload
  //===========================================================================
  
  /**
   * Confirm successful file upload to Object Store
   */
  srv.on('confirmUpload', async (req) => {
    const { attachmentId, storageKey } = req.data;
    const { invitationId } = req.invitation;
    
    try {
      // Verify attachment exists and belongs to this invitation
      const attachment = await db.run(
        SELECT.one.from(AttachmentMetadata)
          .where({ ID: attachmentId, invitation_ID: invitationId })
      );
      
      if (!attachment) {
        req.reject(404, 'Attachment not found', 'ATTACHMENT_NOT_FOUND');
      }
      
      // Update upload status
      await db.run(
        UPDATE(AttachmentMetadata)
          .set({
            uploadStatus: 'COMPLETED',
            storageKey: storageKey
          })
          .where({ ID: attachmentId })
      );
      
      // Create audit log
      await logAuditEvent(
        'DOCUMENT_UPLOADED',
        invitationId,
        null,
        {
          attachmentId: attachmentId,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize
        },
        req
      );
      
      return {
        success: true,
        message: 'File upload confirmed successfully'
      };
      
    } catch (error) {
      console.error('confirmUpload error:', error);
      req.reject(500, 'Failed to confirm upload', 'CONFIRM_FAILED');
    }
  });
  
  //===========================================================================
  // ACTION: deleteAttachment
  //===========================================================================
  
  /**
   * Delete uploaded attachment (before submission)
   */
  srv.on('deleteAttachment', async (req) => {
    const { attachmentId } = req.data;
    const { invitationId } = req.invitation;
    
    try {
      // Get attachment
      const attachment = await db.run(
        SELECT.one.from(AttachmentMetadata)
          .where({ ID: attachmentId, invitation_ID: invitationId })
      );
      
      if (!attachment) {
        req.reject(404, 'Attachment not found', 'ATTACHMENT_NOT_FOUND');
      }
      
      // Check if onboarding data is already submitted
      const onboardingData = await db.run(
        SELECT.one.from(SupplierOnboardingData)
          .where({ invitation_ID: invitationId })
      );
      
      if (onboardingData && onboardingData.onboardingStatus === 'SUBMITTED') {
        req.reject(400, 'Cannot delete attachment after submission', 'SUBMISSION_LOCKED');
      }
      
      // Soft delete attachment
      await db.run(
        UPDATE(AttachmentMetadata)
          .set({
            isDeleted: true,
            deletedAt: new Date()
          })
          .where({ ID: attachmentId })
      );
      
      // TODO: Step 14 - Delete from S3
      
      // Create audit log
      await logAuditEvent(
        'DOCUMENT_DELETED',
        invitationId,
        null,
        {
          attachmentId: attachmentId,
          fileName: attachment.fileName
        },
        req
      );
      
      return {
        success: true,
        message: 'Attachment deleted successfully'
      };
      
    } catch (error) {
      console.error('deleteAttachment error:', error);
      req.reject(500, 'Failed to delete attachment', 'DELETE_FAILED');
    }
  });
  
  //===========================================================================
  // FUNCTION: getMyData
  //===========================================================================
  
  /**
   * Retrieve supplier's onboarding data
   */
  srv.on('getMyData', async (req) => {
    const { invitationId } = req.invitation;
    
    try {
      // Get onboarding data
      const onboardingData = await db.run(
        SELECT.one.from(SupplierOnboardingData)
          .where({ invitation_ID: invitationId })
      );
      
      if (!onboardingData) {
        return {
          onboardingId: null,
          onboardingStatus: null,
          companyLegalName: null,
          email: req.invitation.email,
          submittedAt: null,
          formData: null,
          attachmentCount: 0,
          attachments: []
        };
      }
      
      // Get attachments
      const attachments = await db.run(
        SELECT.from(AttachmentMetadata)
          .where({ invitation_ID: invitationId, isDeleted: false })
          .columns(['ID as attachmentId', 'fileName', 'attachmentType', 'fileSize', 'uploadedAt'])
      );
      
      // Prepare form data JSON
      let formData;
      if (onboardingData.onboardingStatus === 'DRAFT') {
        formData = onboardingData.draftData;
      } else {
        // Convert submitted data to JSON
        formData = JSON.stringify({
          companyLegalName: onboardingData.companyLegalName,
          taxId: onboardingData.taxId,
          vatNumber: onboardingData.vatNumber,
          country_code: onboardingData.country_code,
          street: onboardingData.street,
          city: onboardingData.city,
          postalCode: onboardingData.postalCode,
          primaryContactName: onboardingData.primaryContactName,
          primaryContactEmail: onboardingData.primaryContactEmail,
          primaryContactPhone: onboardingData.primaryContactPhone,
          iban: onboardingData.iban,
          bankName: onboardingData.bankName
        });
      }
      
      return {
        onboardingId: onboardingData.ID,
        onboardingStatus: onboardingData.onboardingStatus,
        companyLegalName: onboardingData.companyLegalName,
        email: onboardingData.email,
        submittedAt: onboardingData.submittedAt,
        formData: formData,
        attachmentCount: attachments.length,
        attachments: attachments
      };
      
    } catch (error) {
      console.error('getMyData error:', error);
      req.reject(500, 'Failed to retrieve data', 'GET_DATA_FAILED');
    }
  });
  
  //===========================================================================
  // FUNCTION: generateDownloadUrl (Placeholder - Step 14)
  //===========================================================================
  
  /**
   * Generate presigned URL for attachment download
   */
  srv.on('generateDownloadUrl', async (req) => {
    const { attachmentId } = req.data;
    const { invitationId } = req.invitation;
    
    try {
      // Verify attachment belongs to supplier
      const attachment = await db.run(
        SELECT.one.from(AttachmentMetadata)
          .where({ ID: attachmentId, invitation_ID: invitationId, isDeleted: false })
      );
      
      if (!attachment) {
        req.reject(404, 'Attachment not found', 'ATTACHMENT_NOT_FOUND');
      }
      
      // TODO: Step 14 - Generate real presigned S3 URL
      const presignedUrl = `https://placeholder-objectstore.s3.amazonaws.com/${attachment.storageKey}?X-Amz-Expires=300`;
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      return {
        presignedUrl: presignedUrl,
        expiresAt: expiresAt,
        fileName: attachment.fileName
      };
      
    } catch (error) {
      console.error('generateDownloadUrl error:', error);
      req.reject(500, 'Failed to generate download URL', 'DOWNLOAD_URL_FAILED');
    }
  });
  
  //===========================================================================
  // FUNCTION: getInvitationInfo
  //===========================================================================
  
  /**
   * Get basic invitation information for UI display
   */
  srv.on('getInvitationInfo', async (req) => {
    const { invitationId } = req.invitation;
    
    try {
      const invitation = await db.run(
        SELECT.one.from(SupplierInvitations)
          .where({ ID: invitationId })
          .columns(['ID as invitationId', 'email', 'companyName', 'contactName', 'expiresAt', 'tokenState'])
      );
      
      if (!invitation) {
        req.reject(404, 'Invitation not found', 'INVITATION_NOT_FOUND');
      }
      
      return invitation;
      
    } catch (error) {
      console.error('getInvitationInfo error:', error);
      req.reject(500, 'Failed to retrieve invitation info', 'GET_INFO_FAILED');
    }
  });
  
  //===========================================================================
  // UTILITY FUNCTIONS
  //===========================================================================
  
  /**
   * Create audit log entry
   * 
   * @param {string} eventType - Type of event
   * @param {string} invitationId - Related invitation ID
   * @param {string} userId - User ID (null for external suppliers)
   * @param {object} eventData - Additional event data
   * @param {object} req - Request object
   */
  async function logAuditEvent(eventType, invitationId, userId, eventData, req) {
    try {
      await db.run(
        INSERT.into(AuditLogs).entries({
          ID: cds.utils.uuid(),
          eventType: eventType,
          invitationId: invitationId,
          userId: userId,
          userName: null,
          ipAddress: req.http?.req?.ip || 'unknown',
          userAgent: req.http?.req?.headers?.['user-agent'] || 'unknown',
          eventData: JSON.stringify(eventData),
          eventTimestamp: new Date()
        })
      );
    } catch (error) {
      console.error('Audit logging failed:', error);
      // Don't throw - audit logging failure shouldn't break main flow
    }
  }
  
  // Expose for testing
  srv._logAuditEvent = logAuditEvent;
  
};
