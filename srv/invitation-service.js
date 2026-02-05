/**
 * Invitation Service Implementation
 * Handles invitation generation and management
 */
module.exports = async function() {
  const cds = require('@sap/cds');
  const { Invitations, Suppliers } = cds.entities('supplier.onboarding');
  
  // CREATE: Generate new invitation
  this.on('generateInvitation', async (req) => {
    const { supplierEmail, supplierName } = req.data;
    
    console.log(`[InvitationService] Generating invitation for ${supplierEmail}`);
    
    // Validate input
    if (!supplierEmail || !supplierName) {
      req.error(400, 'supplierEmail and supplierName are required');
    }
    
    // Check for existing active invitation
    const existingInvitation = await SELECT.one.from(Invitations)
      .where({ supplierEmail, status: 'PENDING' });
    
    if (existingInvitation && new Date(existingInvitation.expiresAt) > new Date()) {
      req.error(409, `Active invitation already exists for ${supplierEmail}`);
    }
    
    // Generate placeholder token (will be JWT in Step 5)
    const mockToken = `MOCK_TOKEN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Create invitation record
    const result = await INSERT.into(Invitations).entries({
      supplierEmail,
      supplierName,
      token: mockToken,
      tokenHash: mockToken.substring(0, 64), // Will use SHA-256 in Step 5
      expiresAt,
      isUsed: false,
      status: 'PENDING',
      createdByUser: req.user?.id || 'system'
    });
    
    // Retrieve the created invitation with ID
    const invitation = await SELECT.one.from(Invitations).where({ token: mockToken });
    
    console.log(`[InvitationService] Created invitation ID: ${invitation.ID}`);
    
    return {
      invitationID: invitation.ID,
      invitationURL: `https://supplier-onboarding.example.com/onboard?token=${mockToken}`,
      token: mockToken,
      expiresAt: expiresAt.toISOString()
    };
  });
  
  // READ: Before reading invitations, check expiration
  this.before('READ', 'Invitations', async (req) => {
    console.log('[InvitationService] Reading invitations');
  });
  
  this.after('READ', 'Invitations', async (invitations) => {
    // Mark expired invitations
    const now = new Date();
    if (Array.isArray(invitations)) {
      for (const inv of invitations) {
        if (inv.expiresAt && new Date(inv.expiresAt) < now && inv.status === 'PENDING') {
          await UPDATE(Invitations, inv.ID).set({ status: 'EXPIRED' });
          inv.status = 'EXPIRED';
        }
      }
    } else if (invitations && invitations.expiresAt) {
      if (new Date(invitations.expiresAt) < now && invitations.status === 'PENDING') {
        await UPDATE(Invitations, invitations.ID).set({ status: 'EXPIRED' });
        invitations.status = 'EXPIRED';
      }
    }
  });
  
  // UPDATE: Prevent updates to readonly fields
  this.before('UPDATE', 'Invitations', async (req) => {
    const readonlyFields = ['token', 'tokenHash', 'expiresAt', 'isUsed', 'usedAt'];
    
    for (const field of readonlyFields) {
      if (req.data[field] !== undefined) {
        req.error(403, `Field '${field}' is read-only and cannot be updated`);
      }
    }
  });
  
  // DELETE: Allow deletion only for PENDING or EXPIRED invitations
  this.before('DELETE', 'Invitations', async (req) => {
    const invitation = await SELECT.one.from(Invitations).where({ ID: req.data.ID });
    
    if (!invitation) {
      req.error(404, 'Invitation not found');
    }
    
    if (invitation.status === 'COMPLETED') {
      req.error(403, 'Cannot delete completed invitations');
    }
    
    console.log(`[InvitationService] Deleting invitation ID: ${req.data.ID}`);
  });
  
  // Log service initialization
  console.log('[InvitationService] Service initialized successfully');
};
