/**
 * Unit Tests for Supplier Service Handlers
 * 
 * Test Coverage:
 * - Token validation middleware
 * - submitSupplierData action (validation, state transitions)
 * - saveDraft action (draft persistence)
 * - uploadAttachment action (file validation)
 * - confirm Upload/deleteAttachment actions
 * - getMyData function (data retrieval)
 * - getInvitationInfo function
 * - Database state changes
 * - Audit logging
 * 
 * Framework: Jest with CAP test utilities
 * 
 * @module test/supplier-service.test
 */

const cds = require('@sap/cds');
const { generateInvitationToken } = require('../srv/lib/token-manager');
const { generateKeyPair } = require('../srv/lib/token-manager');

describe('Supplier Service', () => {
  
  let srv, db, keyPair, testToken, testInvitation;
  
  beforeAll(async () => {
    // Load CAP application
    srv = await cds.connect.to('SupplierService');
    db = await cds.connect.to('db');
    
    // Generate test keypair
    keyPair = generateKeyPair();
    
    // Set environment variables
    process.env.XSUAA_PUBLIC_KEY = keyPair.publicKey;
    process.env.XSUAA_PRIVATE_KEY = keyPair.privateKey;
    process.env.MAX_ATTACHMENTS_PER_SUPPLIER = '10';
    process.env.MAX_FILE_SIZE_MB = '5';
  });
  
  afterAll(async () => {
    await cds.shutdown();
  });
  
  beforeEach(async () => {
    // Clear database
    await db.run(DELETE.from('supplierOnboarding.SupplierInvitations'));
    await db.run(DELETE.from('supplierOnboarding.SupplierOnboardingData'));
    await db.run(DELETE.from('supplierOnboarding.AttachmentMetadata'));
    await db.run(DELETE.from('supplierOnboarding.AuditLogs'));
    
    // Create test invitation
    const invitationId = cds.utils.uuid();
    const email = 'supplier@testcompany.com';
    const companyName = 'Test Company GmbH';
    
    // Generate valid token
    testToken = await generateInvitationToken({
      invitationId,
      email,
      companyName,
      contactName: 'John Doe',
      expiryDays: 7,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    });
    
    // Insert invitation into database
    await db.run(
      INSERT.into('supplierOnboarding.SupplierInvitations').entries({
        ID: invitationId,
        email,
        companyName,
        contactName: 'John Doe',
        tokenHash: testToken.tokenHash,
        jwtPayload: JSON.stringify(testToken.payload),
        tokenState: 'VALIDATED',
        validationAttempts: 1,
        issuedAt: new Date(),
        expiresAt: testToken.expiresAt,
        issuedBy: 'test-user',
        issuedByName: 'Test User'
      })
    );
    
    testInvitation = {
      invitationId,
      email,
      companyName,
      token: testToken.token
    };
  });
  
  // ===========================================================================
  // TOKEN VALIDATION MIDDLEWARE
  // ===========================================================================
  
  describe('Token Validation Middleware', () => {
    
    test('should reject request without token', async () => {
      await expect(
        srv.send({
          query: 'getInvitationInfo',
          headers: {}
        })
      ).rejects.toThrow(/Missing authentication token/);
    });
    
    test('should reject request with invalid token', async () => {
      await expect(
        srv.send({
          query: 'getInvitationInfo',
          headers: {
            authorization: 'Bearer invalid.token.here'
          }
        })
      ).rejects.toThrow();
    });
    
    test('should accept request with valid token', async () => {
      const result = await srv.send({
        query: 'getInvitationInfo',
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result).toBeTruthy();
      expect(result.email).toBe(testInvitation.email);
    });
    
  });
  
  // ===========================================================================
  // SUBMIT SUPPLIER DATA
  // ===========================================================================
  
  describe('submitSupplierData', () => {
    
    beforeEach(async () => {
      // Create test attachment for validation
      await db.run(
        INSERT.into('supplierOnboarding.AttachmentMetadata').entries({
          ID: cds.utils.uuid(),
          invitation_ID: testInvitation.invitationId,
          fileName: 'test-certificate.pdf',
          fileSize: 1024000,
          mimeType: 'application/pdf',
          attachmentType: 'TAX_CERTIFICATE',
          storageKey: 'test-key',
          uploadStatus: 'COMPLETED',
          uploadedAt: new Date(),
          createdAt: new Date(),
          isDeleted: false
        })
      );
    });
    
    test('should submit complete supplier data', async () => {
      const result = await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company GmbH',
          taxId: 'DE123456789',
          vatNumber: 'DE999999999',
          country_code: 'DE',
          street: 'Hauptstrasse 1',
          city: 'Berlin',
          postalCode: '10115',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john.doe@testcompany.com',
          primaryContactPhone: '+49-30-12345678',
          iban: 'DE89370400440532013000',
          bankName: 'Deutsche Bank'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.referenceNumber).toBeTruthy();
      expect(result.onboardingId).toBeTruthy();
      expect(result.message).toContain('successfully');
    });
    
    test('should store data in database', async () => {
      await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company GmbH',
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john.doe@testcompany.com'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const onboardingData = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierOnboardingData')
          .where({ invitation_ID: testInvitation.invitationId })
      );
      
      expect(onboardingData).toBeTruthy();
      expect(onboardingData.companyLegalName).toBe('Test Company GmbH');
      expect(onboardingData.onboardingStatus).toBe('SUBMITTED');
      expect(onboardingData.referenceNumber).toBeTruthy();
    });
    
    test('should update invitation to CONSUMED', async () => {
      await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company GmbH',
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john.doe@testcompany.com'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: testInvitation.invitationId })
      );
      
      expect(invitation.tokenState).toBe('CONSUMED');
      expect(invitation.consumedAt).toBeTruthy();
    });
    
    test('should create audit log', async () => {
      await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company GmbH',
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john.doe@testcompany.com'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'DATA_SUBMITTED' })
      );
      
      expect(auditLogs.length).toBeGreaterThan(0);
    });
    
    test('should fail without company name', async () => {
      const result = await srv.send({
        query: 'submitSupplierData',
        data: {
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john.doe@testcompany.com'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toBeTruthy();
      expect(result.errors.some(e => e.field === 'companyLegalName')).toBe(true);
    });
    
    test('should fail with invalid email', async () => {
      const result = await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company',
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'invalid-email'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'primaryContactEmail')).toBe(true);
    });
    
    test('should fail with invalid IBAN', async () => {
      const result = await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company',
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john@test.com',
          iban: 'INVALID-IBAN'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'iban')).toBe(true);
    });
    
    test('should fail without attachments', async () => {
      // Delete test attachment
      await db.run(
        DELETE.from('supplierOnboarding.AttachmentMetadata')
          .where({ invitation_ID: testInvitation.invitationId })
      );
      
      const result = await srv.send({
        query: 'submitSupplierData',
        data: {
          companyLegalName: 'Test Company',
          taxId: 'DE123456789',
          country_code: 'DE',
          primaryContactName: 'John Doe',
          primaryContactEmail: 'john@test.com'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.field === 'attachments')).toBe(true);
    });
    
    test('should fail if invitation already consumed', async () => {
      // Mark invitation as consumed
      await db.run(
        UPDATE('supplierOnboarding.SupplierInvitations')
          .set({ tokenState: 'CONSUMED' })
          .where({ ID: testInvitation.invitationId })
      );
      
      await expect(
        srv.send({
          query: 'submitSupplierData',
          data: {
            companyLegalName: 'Test Company',
            taxId: 'DE123456789',
            country_code: 'DE',
            primaryContactName: 'John Doe',
            primaryContactEmail: 'john@test.com'
          },
          headers: {
            authorization: `Bearer ${testInvitation.token}`
          }
        })
      ).rejects.toThrow(/already been used/);
    });
    
  });
  
  // ===========================================================================
  // SAVE DRAFT
  // ===========================================================================
  
  describe('saveDraft', () => {
    
    test('should save draft data', async () => {
      const formData = {
        companyLegalName: 'Test Company',
        taxId: 'DE123456789',
        city: 'Berlin'
      };
      
      const result = await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify(formData)
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.onboardingId).toBeTruthy();
      expect(result.savedAt).toBeTruthy();
    });
    
    test('should store draft in database', async () => {
      const formData = { companyLegalName: 'Test Company' };
      
      const result = await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify(formData)
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const onboardingData = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierOnboardingData')
          .where({ ID: result.onboardingId })
      );
      
      expect(onboardingData).toBeTruthy();
      expect(onboardingData.onboardingStatus).toBe('DRAFT');
      expect(onboardingData.draftData).toBeTruthy();
    });
    
    test('should update invitation state to OPENED', async () => {
      await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify({ test: 'data' })
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const invitation = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierInvitations')
          .where({ ID: testInvitation.invitationId })
      );
      
      expect(invitation.tokenState).toBe('OPENED');
    });
    
    test('should update existing draft', async () => {
      // First save
      const result1 = await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify({ field1: 'value1' })
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      // Second save (update)
      const result2 = await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify({ field1: 'updated', field2: 'value2' })
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result2.onboardingId).toBe(result1.onboardingId);
      
      const onboardingData = await db.run(
        SELECT.one.from('supplierOnboarding.SupplierOnboardingData')
          .where({ ID: result2.onboardingId })
      );
      
      const draftData = JSON.parse(onboardingData.draftData);
      expect(draftData.field1).toBe('updated');
      expect(draftData.field2).toBe('value2');
    });
    
    test('should create audit log on first save', async () => {
      await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify({ test: 'data' })
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const auditLogs = await db.run(
        SELECT.from('supplierOnboarding.AuditLogs')
          .where({ eventType: 'ONBOARDING_STARTED' })
      );
      
      expect(auditLogs.length).toBe(1);
    });
    
  });
  
  // ===========================================================================
  // UPLOAD ATTACHMENT
  // ===========================================================================
  
  describe('uploadAttachment', () => {
    
    test('should generate presigned URL', async () => {
      const result = await srv.send({
        query: 'uploadAttachment',
        data: {
          fileName: 'test-certificate.pdf',
          fileSize: 1024000,
          mimeType: 'application/pdf',
          attachmentType: 'TAX_CERTIFICATE',
          description: 'Tax certificate 2025'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.presignedUrl).toBeTruthy();
      expect(result.storageKey).toBeTruthy();
      expect(result.attachmentId).toBeTruthy();
      expect(result.expiresAt).toBeTruthy();
    });
    
    test('should create attachment metadata', async () => {
      const result = await srv.send({
        query: 'uploadAttachment',
        data: {
          fileName: 'test.pdf',
          fileSize: 1024000,
          mimeType: 'application/pdf',
          attachmentType: 'TAX_CERTIFICATE'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const attachment = await db.run(
        SELECT.one.from('supplierOnboarding.AttachmentMetadata')
          .where({ ID: result.attachmentId })
      );
      
      expect(attachment).toBeTruthy();
      expect(attachment.fileName).toBe('test.pdf');
      expect(attachment.uploadStatus).toBe('PENDING');
    });
    
    test('should reject file too large', async () => {
      await expect(
        srv.send({
          query: 'uploadAttachment',
          data: {
            fileName: 'large-file.pdf',
            fileSize: 10 * 1024 * 1024, // 10MB
            mimeType: 'application/pdf',
            attachmentType: 'TAX_CERTIFICATE'
          },
          headers: {
            authorization: `Bearer ${testInvitation.token}`
          }
        })
      ).rejects.toThrow(/File size exceeds/);
    });
    
    test('should reject invalid MIME type', async () => {
      await expect(
        srv.send({
          query: 'uploadAttachment',
          data: {
            fileName: 'test.exe',
            fileSize: 1024000,
            mimeType: 'application/x-msdownload',
            attachmentType: 'OTHER'
          },
          headers: {
            authorization: `Bearer ${testInvitation.token}`
          }
        })
      ).rejects.toThrow(/File type not allowed/);
    });
    
  });
  
  // ===========================================================================
  // GET MY DATA
  // ===========================================================================
  
  describe('getMyData', () => {
    
    test('should return null for new supplier', async () => {
      const result = await srv.send({
        query: 'getMyData',
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.onboardingId).toBeNull();
      expect(result.onboardingStatus).toBeNull();
      expect(result.email).toBe(testInvitation.email);
    });
    
    test('should return draft data', async () => {
      // Save draft first
      await srv.send({
        query: 'saveDraft',
        data: {
          formData: JSON.stringify({ companyLegalName: 'Test Company' })
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const result = await srv.send({
        query: 'getMyData',
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.onboardingStatus).toBe('DRAFT');
      expect(result.formData).toBeTruthy();
    });
    
    test('should return attachments list', async () => {
      // Upload attachment
      const uploadResult = await srv.send({
        query: 'uploadAttachment',
        data: {
          fileName: 'test.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          attachmentType: 'TAX_CERTIFICATE'
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      // Confirm upload
      await srv.send({
        query: 'confirmUpload',
        data: {
          attachmentId: uploadResult.attachmentId,
          storageKey: uploadResult.storageKey
        },
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      const result = await srv.send({
        query: 'getMyData',
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.attachmentCount).toBe(1);
      expect(result.attachments.length).toBe(1);
      expect(result.attachments[0].fileName).toBe('test.pdf');
    });
    
  });
  
  // ===========================================================================
  // GET INVITATION INFO
  // ===========================================================================
  
  describe('getInvitationInfo', () => {
    
    test('should return invitation details', async () => {
      const result = await srv.send({
        query: 'getInvitationInfo',
        headers: {
          authorization: `Bearer ${testInvitation.token}`
        }
      });
      
      expect(result.invitationId).toBe(testInvitation.invitationId);
      expect(result.email).toBe(testInvitation.email);
      expect(result.companyName).toBe(testInvitation.companyName);
      expect(result.tokenState).toBe('VALIDATED');
    });
    
  });
  
});
